import {
  buildQueries,
  RATE_WINDOW,
  SERIES_KEYS,
  SERIES_RANGE_SECONDS,
  SERIES_STEP_SECONDS,
  type MetricKey,
  type SeriesKey,
} from './ObservabilityQueries';
import type { Point, PrometheusQueryClient } from './PrometheusClient';

// GET /api/platform/observability/components/:component/environments/:environment.
// Every metric is `number | null`: null means "no data" (no traffic, no
// limit, no deployment, no series), never a stand-in for 0. `unavailable`
// lists metrics whose query itself failed, so a partial Prometheus failure
// isn't mistaken for "no data".
export interface ObservabilitySummary {
  component: string;
  environment: string;
  // When the values were read, and over what windows.
  generatedAt: string;
  rateWindow: string;
  requestRate: number | null;
  errorRatePercent: number | null;
  p95LatencySeconds: number | null;
  cpuUtilizationPercent: number | null;
  memoryUtilizationPercent: number | null;
  // null unless both counts are known.
  replicas: { available: number; desired: number } | null;
  // increase() extrapolates, so it's rounded to whole restarts.
  restarts1h: number | null;
  unavailable: MetricKey[];
  // The last 30 minutes of each rate/utilization metric, one point per
  // scrape interval, for the sparklines. A failed range query is just an
  // empty trend: the current value above is what the card is about.
  series: {
    stepSeconds: number;
    points: Record<SeriesKey, Point[]>;
  };
}

export class PrometheusUnavailableError extends Error {}

export async function readObservabilitySummary(
  client: PrometheusQueryClient,
  component: string,
  environment: string,
  now: Date = new Date(),
): Promise<ObservabilitySummary> {
  const queries = buildQueries(component, environment);
  const keys = Object.keys(queries) as MetricKey[];
  // Align the range to the step so consecutive refreshes share points.
  const end = Math.floor(now.getTime() / 1000 / SERIES_STEP_SECONDS) * SERIES_STEP_SECONDS;
  const start = end - SERIES_RANGE_SECONDS;

  const [results, ranges] = await Promise.all([
    Promise.allSettled(keys.map(key => client.queryScalar(queries[key]))),
    Promise.allSettled(
      SERIES_KEYS.map(key => client.queryRange(queries[key], start, end, SERIES_STEP_SECONDS)),
    ),
  ]);

  const values = {} as Record<MetricKey, number | null>;
  const unavailable: MetricKey[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      values[keys[i]] = result.value;
    } else {
      values[keys[i]] = null;
      unavailable.push(keys[i]);
    }
  });

  if (unavailable.length === keys.length) {
    const reason = (results[0] as PromiseRejectedResult).reason;
    throw new PrometheusUnavailableError(
      reason instanceof Error ? reason.message : String(reason),
    );
  }

  const points = {} as Record<SeriesKey, Point[]>;
  ranges.forEach((range, i) => {
    points[SERIES_KEYS[i]] = range.status === 'fulfilled' ? range.value : [];
  });

  const { replicasAvailable, replicasDesired, restarts1h } = values;
  return {
    component,
    environment,
    generatedAt: now.toISOString(),
    rateWindow: RATE_WINDOW,
    requestRate: values.requestRate,
    errorRatePercent: values.errorRatePercent,
    p95LatencySeconds: values.p95LatencySeconds,
    cpuUtilizationPercent: values.cpuUtilizationPercent,
    memoryUtilizationPercent: values.memoryUtilizationPercent,
    replicas:
      replicasAvailable !== null && replicasDesired !== null
        ? { available: replicasAvailable, desired: replicasDesired }
        : null,
    restarts1h: restarts1h === null ? null : Math.round(restarts1h),
    unavailable,
    series: { stepSeconds: SERIES_STEP_SECONDS, points },
  };
}
