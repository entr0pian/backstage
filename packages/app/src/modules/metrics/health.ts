import { formatPercent, type ObservabilitySummary } from './summary';

// Presentation state of one tile. Derived here from the summary and
// explicit rules, never from formatted text, so the rules can be read (and
// tested) in one place.
export type MetricState = 'normal' | 'warning' | 'critical' | 'unknown';

export type TileKey =
  | 'requestRate'
  | 'errorRate'
  | 'p95Latency'
  | 'cpu'
  | 'memory'
  | 'replicas'
  | 'restarts';

export interface MetricEvaluation {
  state: MetricState;
  // Why the tile is in this state, for the tile's context line and the
  // overall status tooltip. Absent for plain normal values.
  reason?: string;
}

export type OverallHealth = 'healthy' | 'degraded' | 'scaled-to-zero' | 'unknown';

export interface HealthEvaluation {
  overall: OverallHealth;
  // Degraded: one line per critical metric. Unknown: what's missing.
  reasons: string[];
  metrics: Record<TileKey, MetricEvaluation>;
}

// 5xx share of requests at which a service counts as Degraded. Not an SLO.
export const ERROR_RATE_DEGRADED_PERCENT = 5;

// The rules (OBSERVABILLITY_PART4 severity semantics):
//
// | Signal       | Condition             | Tile     | Overall  |
// |--------------|-----------------------|----------|----------|
// | Error rate   | >= 5%                 | critical | Degraded |
// | Replicas     | available < desired   | critical | Degraded |
// | Restarts 1h  | > 0                   | warning  | —        |
// | anything     | query failed / absent | unknown  | see below|
// | Request rate, P95, CPU, memory | any  | normal   | —        |
//
// Request rate, latency, CPU and memory have no platform-wide "bad" value
// (that needs a per-service objective), so they're informational only.
//
// Overall: Degraded if any critical rule fires — a known failure wins even
// when other data is missing. Otherwise Unknown if the replica counts or
// the error-rate query are unavailable: missing data is never Healthy.
// Otherwise Scaled to zero (desired 0) or Healthy. No traffic (error rate
// null because there were no requests) is not missing data.
export function evaluateHealth(summary: ObservabilitySummary): HealthEvaluation {
  const failed = (key: string) => summary.unavailable.includes(key);
  const informational = (key: string, value: number | null): MetricEvaluation => {
    if (failed(key)) return { state: 'unknown', reason: 'Could not be queried' };
    return value === null ? { state: 'unknown' } : { state: 'normal' };
  };

  let errorRate: MetricEvaluation;
  if (failed('errorRatePercent')) {
    errorRate = { state: 'unknown', reason: 'Could not be queried' };
  } else if (summary.errorRatePercent === null) {
    errorRate = { state: 'normal', reason: `No traffic in the last ${summary.rateWindow}` };
  } else if (summary.errorRatePercent >= ERROR_RATE_DEGRADED_PERCENT) {
    errorRate = {
      state: 'critical',
      reason: `5xx error rate is ${formatPercent(summary.errorRatePercent)}`,
    };
  } else {
    errorRate = { state: 'normal' };
  }

  const { replicas } = summary;
  let replicasEval: MetricEvaluation;
  if (failed('replicasAvailable') || failed('replicasDesired')) {
    replicasEval = { state: 'unknown', reason: 'Could not be queried' };
  } else if (!replicas) {
    replicasEval = { state: 'unknown', reason: 'No Deployment found' };
  } else if (replicas.available < replicas.desired) {
    replicasEval = {
      state: 'critical',
      reason: `${replicas.available} of ${replicas.desired} replicas available`,
    };
  } else {
    replicasEval = { state: 'normal' };
  }

  let restarts: MetricEvaluation;
  if (failed('restarts1h')) {
    restarts = { state: 'unknown', reason: 'Could not be queried' };
  } else if (summary.restarts1h === null) {
    restarts = { state: 'unknown' };
  } else if (summary.restarts1h > 0) {
    const n = summary.restarts1h;
    restarts = {
      state: 'warning',
      reason: `${n} container restart${n === 1 ? '' : 's'} during the last hour`,
    };
  } else {
    restarts = { state: 'normal' };
  }

  const metrics: Record<TileKey, MetricEvaluation> = {
    requestRate: informational('requestRate', summary.requestRate),
    errorRate,
    p95Latency: informational('p95LatencySeconds', summary.p95LatencySeconds),
    cpu: informational('cpuUtilizationPercent', summary.cpuUtilizationPercent),
    memory: informational('memoryUtilizationPercent', summary.memoryUtilizationPercent),
    replicas: replicasEval,
    restarts,
  };

  // Replicas first: a missing replica is the more fundamental failure.
  const critical = [replicasEval, errorRate].filter(m => m.state === 'critical');
  if (critical.length > 0) {
    return { overall: 'degraded', reasons: critical.map(m => m.reason!), metrics };
  }

  const missing: string[] = [];
  if (replicasEval.state === 'unknown') {
    missing.push(
      replicasEval.reason === 'Could not be queried'
        ? 'Replica counts are unavailable'
        : 'No platform Deployment found in this environment',
    );
  }
  if (errorRate.state === 'unknown') missing.push('Error rate is unavailable');
  if (missing.length > 0) {
    return { overall: 'unknown', reasons: missing, metrics };
  }

  if (replicas!.desired === 0) {
    return { overall: 'scaled-to-zero', reasons: ['The Deployment is scaled to 0 replicas'], metrics };
  }
  const traffic =
    summary.errorRatePercent === null
      ? `no traffic in the last ${summary.rateWindow}`
      : `${formatPercent(summary.errorRatePercent)} 5xx over ${summary.rateWindow}`;
  return {
    overall: 'healthy',
    reasons: [`${replicas!.available} of ${replicas!.desired} replicas available, ${traffic}`],
    metrics,
  };
}
