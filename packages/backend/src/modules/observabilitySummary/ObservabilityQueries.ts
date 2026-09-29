// The fixed PromQL behind the Metrics tab (OBSERVABILLITY_PART4.md Part 3).
// The browser only ever names a component and an environment; every query,
// metric name and range lives here. Queries read application metrics (plus
// the scrape's own `up`) and the platform.infrastructure recording rules (helm-charts/platform's
// platform-observability.yaml) only — never kube_* or raw cAdvisor series —
// and mirror the Platform — Service Overview dashboard's panels, so the two
// agree.

// Kubernetes label-value syntax: the component/environment are the values
// of the platform.taskapp.io/{component,environment} workload labels. The
// allowed characters include no quote or backslash, so a valid value can't
// break out of a PromQL string literal.
const LABEL_VALUE = /^[A-Za-z0-9]([A-Za-z0-9._-]{0,61}[A-Za-z0-9])?$/;

export function isValidIdentity(value: string): boolean {
  return LABEL_VALUE.test(value);
}

// HTTP series are scraped every 30s; 2m (4 samples) is the shortest window
// that stays stable through a missed scrape, and is what Grafana's
// $__rate_interval resolves to on the Service Overview dashboard's default
// 1h range — so both show the same number.
export const RATE_WINDOW = '2m';

// The trend each sparkline shows: the last 30 minutes at the scrape interval.
export const SERIES_RANGE_SECONDS = 30 * 60;
export const SERIES_STEP_SECONDS = 30;

export type MetricKey =
  | 'requestRate'
  | 'errorRatePercent'
  | 'p95LatencySeconds'
  | 'cpuUtilizationPercent'
  | 'memoryUtilizationPercent'
  | 'replicasAvailable'
  | 'replicasDesired'
  | 'restarts1h';

// The metrics that also get a trend series (same query, as a range query).
export const SERIES_KEYS = [
  'requestRate',
  'errorRatePercent',
  'p95LatencySeconds',
  'cpuUtilizationPercent',
  'memoryUtilizationPercent',
] as const satisfies readonly MetricKey[];
export type SeriesKey = (typeof SERIES_KEYS)[number];

// Each query returns a single scalar-like sample, or nothing when there's
// no data — which stays null rather than becoming 0:
// - requestRate: 0 when the service is scraped (`up`) but has served no
//   request yet — the HTTP counters only appear after the first request —
//   and nothing when it isn't scraped at all.
// - errorRatePercent: nothing when there's no traffic (divide by `> 0`).
// - p95LatencySeconds: nothing when there's no traffic (`>= 0` drops NaN).
// - cpu/memory utilization: nothing when no container has a limit.
export function buildQueries(component: string, environment: string): Record<MetricKey, string> {
  if (!isValidIdentity(component) || !isValidIdentity(environment)) {
    throw new Error('Invalid component or environment');
  }
  const s = `component="${component}", environment="${environment}"`;
  return {
    requestRate: `sum(rate(http_requests_total{${s}}[${RATE_WINDOW}])) or 0 * sum(up{${s}})`,
    errorRatePercent:
      `100 * (sum(rate(http_requests_total{${s}, status=~"5.."}[${RATE_WINDOW}])) or vector(0))` +
      ` / (sum(rate(http_requests_total{${s}}[${RATE_WINDOW}])) > 0)`,
    p95LatencySeconds:
      `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{${s}}[${RATE_WINDOW}]))) >= 0`,
    // Usage only of containers that have a limit, over the sum of limits.
    cpuUtilizationPercent:
      `100 * sum(platform:container_cpu_usage_cores{${s}}` +
      ` and on (namespace, pod, container) platform:container_cpu_limit_cores{${s}})` +
      ` / (sum(platform:container_cpu_limit_cores{${s}}) > 0)`,
    memoryUtilizationPercent:
      `100 * sum(platform:container_memory_working_set_bytes{${s}}` +
      ` and on (namespace, pod, container) platform:container_memory_limit_bytes{${s}})` +
      ` / (sum(platform:container_memory_limit_bytes{${s}}) > 0)`,
    replicasAvailable: `sum(platform:deployment_replicas_available{${s}})`,
    replicasDesired: `sum(platform:deployment_replicas_desired{${s}})`,
    restarts1h: `sum(increase(platform:container_restarts_total{${s}}[1h]))`,
  };
}
