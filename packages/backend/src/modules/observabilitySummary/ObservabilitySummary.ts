import { buildQueries, type MetricKey } from './ObservabilityQueries';
import type { InstantQueryClient } from './PrometheusClient';

// GET /api/platform/observability/components/:component/environments/:environment.
// Every metric is `number | null`: null means "no data" (no traffic, no
// limit, no deployment, no series), never a stand-in for 0. `unavailable`
// lists metrics whose query itself failed, so a partial Prometheus failure
// isn't mistaken for "no data".
export interface ObservabilitySummary {
  component: string;
  environment: string;
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
}

export class PrometheusUnavailableError extends Error {}

export async function readObservabilitySummary(
  client: InstantQueryClient,
  component: string,
  environment: string,
): Promise<ObservabilitySummary> {
  const queries = buildQueries(component, environment);
  const keys = Object.keys(queries) as MetricKey[];
  const results = await Promise.allSettled(keys.map(key => client.queryScalar(queries[key])));

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

  const { replicasAvailable, replicasDesired, restarts1h } = values;
  return {
    component,
    environment,
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
  };
}
