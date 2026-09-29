import express from 'express';
import type { AddressInfo } from 'node:net';
import type { LoggerService } from '@backstage/backend-plugin-api';
import { buildQueries, isValidIdentity, type MetricKey } from './ObservabilityQueries';
import { readObservabilitySummary } from './ObservabilitySummary';
import type { Point, PrometheusQueryClient } from './PrometheusClient';
import { createObservabilityRouter } from './router';

// Answers each fixed query by which metric it is, so tests don't depend on
// query order or wording.
function fakePrometheus(
  answers: Partial<Record<MetricKey, number | null | Error>>,
  ranges: Partial<Record<MetricKey, Point[] | Error>> = {},
): PrometheusQueryClient & { queries: string[]; rangeQueries: { promql: string; start: number; end: number; step: number }[] } {
  const byQuery = new Map(
    Object.entries(buildQueries('payments', 'management')).map(([k, q]) => [q, k as MetricKey]),
  );
  const queries: string[] = [];
  const rangeQueries: { promql: string; start: number; end: number; step: number }[] = [];
  return {
    queries,
    rangeQueries,
    async queryRange(promql: string, start: number, end: number, step: number) {
      rangeQueries.push({ promql, start, end, step });
      const key = byQuery.get(promql);
      const answer = key === undefined ? undefined : ranges[key];
      if (answer instanceof Error) throw answer;
      return answer ?? [];
    },
    async queryScalar(promql: string) {
      queries.push(promql);
      const key = byQuery.get(promql);
      const answer = key === undefined ? null : answers[key];
      if (answer instanceof Error) throw answer;
      return answer ?? null;
    },
  };
}

const HEALTHY: Partial<Record<MetricKey, number>> = {
  requestRate: 12.4,
  errorRatePercent: 0,
  p95LatencySeconds: 0.042,
  cpuUtilizationPercent: 18,
  memoryUtilizationPercent: 41,
  replicasAvailable: 2,
  replicasDesired: 2,
  restarts1h: 0,
};

const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown as LoggerService;

// Serves the router on an ephemeral port and makes one GET against it.
async function get(prometheus: PrometheusQueryClient, path: string) {
  const server = express()
    .use(createObservabilityRouter({ prometheus, logger }))
    .listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    const json = res.headers.get('content-type')?.includes('application/json');
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers),
      body: json ? await res.json() : undefined,
    };
  } finally {
    server.close();
  }
}

const URL = '/observability/components/payments/environments/management';

describe('buildQueries', () => {
  it('inserts component and environment into every fixed query', () => {
    const queries = buildQueries('payments', 'management');
    for (const promql of Object.values(queries)) {
      expect(promql).toContain('component="payments", environment="management"');
    }
  });

  it('reads only application metrics and platform recording rules', () => {
    for (const promql of Object.values(buildQueries('payments', 'management'))) {
      expect(promql).not.toMatch(/kube_|container_cpu_usage_seconds_total|label_platform/);
      for (const metric of promql.match(/[a-z_:]+(?=\{)/g) ?? []) {
        expect(metric).toMatch(/^(platform:|http_request|up$)/);
      }
    }
  });

  it('rejects values that could escape a PromQL string literal', () => {
    for (const bad of ['pay"ments', 'a\\b', 'x"}) or vector(1', '', 'a b', 'a'.repeat(64), '-x']) {
      expect(isValidIdentity(bad)).toBe(false);
      expect(() => buildQueries(bad, 'management')).toThrow();
      expect(() => buildQueries('payments', bad)).toThrow();
    }
    expect(isValidIdentity('payments-db.v2_x')).toBe(true);
  });
});

describe('readObservabilitySummary', () => {
  it('maps query results onto the response contract', async () => {
    const summary = await readObservabilitySummary(
      fakePrometheus({ ...HEALTHY, restarts1h: 1.04 }),
      'payments',
      'management',
    );
    expect(summary).toEqual({
      component: 'payments',
      environment: 'management',
      requestRate: 12.4,
      errorRatePercent: 0,
      p95LatencySeconds: 0.042,
      cpuUtilizationPercent: 18,
      memoryUtilizationPercent: 41,
      replicas: { available: 2, desired: 2 },
      restarts1h: 1,
      unavailable: [],
      generatedAt: expect.any(String),
      rateWindow: '2m',
      series: {
        stepSeconds: 30,
        points: {
          requestRate: [],
          errorRatePercent: [],
          p95LatencySeconds: [],
          cpuUtilizationPercent: [],
          memoryUtilizationPercent: [],
        },
      },
    });
  });

  it('keeps missing data as null, not zero', async () => {
    const summary = await readObservabilitySummary(fakePrometheus({}), 'payments', 'management');
    expect(summary).toMatchObject({
      requestRate: null,
      errorRatePercent: null,
      p95LatencySeconds: null,
      cpuUtilizationPercent: null,
      memoryUtilizationPercent: null,
      replicas: null,
      restarts1h: null,
      unavailable: [],
    });
  });

  it('reports replicas only when both counts are known', async () => {
    const summary = await readObservabilitySummary(
      fakePrometheus({ replicasDesired: 2 }),
      'payments',
      'management',
    );
    expect(summary.replicas).toBeNull();
  });

  it('marks individually failed queries unavailable', async () => {
    const summary = await readObservabilitySummary(
      fakePrometheus({ ...HEALTHY, p95LatencySeconds: new Error('timeout') }),
      'payments',
      'management',
    );
    expect(summary.p95LatencySeconds).toBeNull();
    expect(summary.unavailable).toEqual(['p95LatencySeconds']);
    expect(summary.requestRate).toBe(12.4);
  });
});

describe('trend series', () => {
  const NOW = new Date('2026-09-29T12:00:10Z');

  it('asks for the last 30 minutes at the scrape step, aligned to the step', async () => {
    const prometheus = fakePrometheus(HEALTHY);
    await readObservabilitySummary(prometheus, 'payments', 'management', NOW);
    const end = Date.parse('2026-09-29T12:00:00Z') / 1000;
    expect(prometheus.rangeQueries.map(q => [q.start, q.end, q.step])).toEqual(
      Array(5).fill([end - 1800, end, 30]),
    );
    const queries = buildQueries('payments', 'management');
    expect(prometheus.rangeQueries.map(q => q.promql)).toEqual([
      queries.requestRate,
      queries.errorRatePercent,
      queries.p95LatencySeconds,
      queries.cpuUtilizationPercent,
      queries.memoryUtilizationPercent,
    ]);
  });

  it('returns the points, and an empty trend when a range query fails', async () => {
    const summary = await readObservabilitySummary(
      fakePrometheus(HEALTHY, {
        requestRate: [[1, 2], [31, 3]],
        p95LatencySeconds: new Error('timeout'),
      }),
      'payments',
      'management',
      NOW,
    );
    expect(summary.series.points.requestRate).toEqual([[1, 2], [31, 3]]);
    expect(summary.series.points.p95LatencySeconds).toEqual([]);
    expect(summary.unavailable).toEqual([]);
  });
});

describe('observability router', () => {
  it('returns the summary for a component/environment', async () => {
    const res = await get(fakePrometheus(HEALTHY), URL);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ component: 'payments', environment: 'management', requestRate: 12.4 });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('ignores any query string — PromQL cannot be supplied', async () => {
    const prometheus = fakePrometheus(HEALTHY);
    const res = await get(
      prometheus,
      `${URL}?${new URLSearchParams({ query: 'up', metric: 'up', path: '/api/v1/admin/tsdb/delete_series' })}`,
    );
    expect(res.status).toBe(200);
    const fixed = Object.values(buildQueries('payments', 'management'));
    expect(prometheus.queries).toEqual(fixed);
    for (const { promql } of prometheus.rangeQueries) {
      expect(fixed).toContain(promql);
    }
  });

  it('rejects an identity that is not a label value', async () => {
    const prometheus = fakePrometheus(HEALTHY);
    const res = await get(
      prometheus,
      `/observability/components/${encodeURIComponent('x"} or up{a="')}/environments/management`,
    );
    expect(res.status).toBe(400);
    expect(prometheus.queries).toEqual([]);
    expect(prometheus.rangeQueries).toEqual([]);
  });

  it('exposes no other route', async () => {
    for (const path of ['/observability/query?query=up', '/observability/api/v1/query', '/observability/components/payments']) {
      expect((await get(fakePrometheus(HEALTHY), path)).status).toBe(404);
    }
  });

  it('answers 503 when Prometheus is unreachable', async () => {
    const refuse = async () => {
      throw new Error('ECONNREFUSED');
    };
    const down: PrometheusQueryClient = { queryScalar: refuse, queryRange: refuse };
    const res = await get(down, URL);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Metrics are unavailable right now' });
  });
});
