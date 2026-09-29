import { evaluateHealth, type TileKey } from './health';
import type { ObservabilitySummary } from './summary';

function summary(overrides: Partial<ObservabilitySummary> = {}): ObservabilitySummary {
  return {
    component: 'payments',
    environment: 'management',
    generatedAt: '2026-09-29T12:00:00Z',
    rateWindow: '2m',
    requestRate: 14.2,
    errorRatePercent: 0,
    p95LatencySeconds: 0.18,
    cpuUtilizationPercent: 32,
    memoryUtilizationPercent: 65,
    replicas: { available: 2, desired: 2 },
    restarts1h: 0,
    unavailable: [],
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
    ...overrides,
  };
}

const states = (s: ObservabilitySummary) =>
  Object.fromEntries(
    Object.entries(evaluateHealth(s).metrics).map(([k, v]) => [k, v.state]),
  ) as Record<TileKey, string>;

describe('evaluateHealth', () => {
  it('healthy: every tile normal', () => {
    const health = evaluateHealth(summary());
    expect(health.overall).toBe('healthy');
    expect(Object.values(states(summary()))).toEqual(Array(7).fill('normal'));
    expect(health.reasons).toEqual(['2 of 2 replicas available, 0% 5xx over 2m']);
  });

  it('error rate >= 5% degrades and flags only the error rate', () => {
    const s = summary({ errorRatePercent: 6 });
    const health = evaluateHealth(s);
    expect(health.overall).toBe('degraded');
    expect(health.reasons).toEqual(['5xx error rate is 6%']);
    expect(states(s)).toMatchObject({ errorRate: 'critical', replicas: 'normal', restarts: 'normal' });
  });

  it('a replica shortfall degrades and flags only the replicas', () => {
    const s = summary({ replicas: { available: 1, desired: 2 } });
    const health = evaluateHealth(s);
    expect(health.overall).toBe('degraded');
    expect(health.reasons).toEqual(['1 of 2 replicas available']);
    expect(states(s)).toMatchObject({ replicas: 'critical', errorRate: 'normal' });
  });

  it('restarts warn without degrading the service', () => {
    const s = summary({ restarts1h: 3 });
    const health = evaluateHealth(s);
    expect(health.overall).toBe('healthy');
    expect(health.metrics.restarts).toEqual({
      state: 'warning',
      reason: '3 container restarts during the last hour',
    });
    expect(evaluateHealth(summary({ restarts1h: 1 })).metrics.restarts.reason).toBe(
      '1 container restart during the last hour',
    );
  });

  it('reports every simultaneous problem', () => {
    const s = summary({ errorRatePercent: 8, replicas: { available: 1, desired: 2 }, restarts1h: 4 });
    const health = evaluateHealth(s);
    expect(health.overall).toBe('degraded');
    expect(health.reasons).toEqual(['1 of 2 replicas available', '5xx error rate is 8%']);
    expect(states(s)).toMatchObject({ errorRate: 'critical', replicas: 'critical', restarts: 'warning' });
  });

  it('never claims Healthy without the data to decide', () => {
    expect(evaluateHealth(summary({ replicas: null }))).toMatchObject({
      overall: 'unknown',
      reasons: ['No platform Deployment found in this environment'],
    });
    const failed = evaluateHealth(summary({ replicas: null, unavailable: ['replicasAvailable'] }));
    expect(failed.overall).toBe('unknown');
    expect(failed.reasons).toEqual(['Replica counts are unavailable']);
    expect(evaluateHealth(summary({ errorRatePercent: null, unavailable: ['errorRatePercent'] })).overall).toBe(
      'unknown',
    );
  });

  it('a known failure still shows Degraded when other data is missing', () => {
    const s = summary({ errorRatePercent: 9, replicas: null });
    expect(evaluateHealth(s).overall).toBe('degraded');
  });

  it('no traffic is not missing data', () => {
    const s = summary({ errorRatePercent: null, requestRate: 0, p95LatencySeconds: null });
    const health = evaluateHealth(s);
    expect(health.overall).toBe('healthy');
    expect(health.metrics.errorRate).toEqual({ state: 'normal', reason: 'No traffic in the last 2m' });
    expect(health.reasons).toEqual(['2 of 2 replicas available, no traffic in the last 2m']);
  });

  it('keeps request rate, latency, CPU and memory informational at any value', () => {
    const s = summary({ requestRate: 5000, p95LatencySeconds: 9, cpuUtilizationPercent: 99, memoryUtilizationPercent: 98 });
    expect(evaluateHealth(s).overall).toBe('healthy');
    expect(states(s)).toMatchObject({ requestRate: 'normal', p95Latency: 'normal', cpu: 'normal', memory: 'normal' });
    expect(states(summary({ cpuUtilizationPercent: null }))).toMatchObject({ cpu: 'unknown' });
  });

  it('scaled to zero is its own state', () => {
    expect(evaluateHealth(summary({ replicas: { available: 0, desired: 0 } })).overall).toBe('scaled-to-zero');
  });
});
