// Mirrors the backend's ObservabilitySummary
// (packages/backend/src/modules/observabilitySummary/ObservabilitySummary.ts).
// null = no data (no traffic, no limit, no deployment), never 0.
export interface ObservabilitySummary {
  component: string;
  environment: string;
  requestRate: number | null;
  errorRatePercent: number | null;
  p95LatencySeconds: number | null;
  cpuUtilizationPercent: number | null;
  memoryUtilizationPercent: number | null;
  replicas: { available: number; desired: number } | null;
  restarts1h: number | null;
  // Metrics whose query failed (as opposed to returning no data).
  unavailable: string[];
}

// Error-rate threshold for the Degraded state. Not an SLO, just a line.
export const ERROR_RATE_DEGRADED_PERCENT = 5;

export type MetricsHealth = 'healthy' | 'degraded' | 'scaled-to-zero' | 'no-data';

// Deterministic, from two direct signals only (OBSERVABILLITY_PART4.md 3.8):
// - no-data: replica counts unknown (no platform Deployment found).
// - scaled-to-zero: desired replicas is 0.
// - degraded: available < desired, or error rate >= ERROR_RATE_DEGRADED_PERCENT.
// - healthy: otherwise. No traffic (error rate null) doesn't count against it.
export function metricsHealth(summary: ObservabilitySummary): MetricsHealth {
  const { replicas, errorRatePercent } = summary;
  if (!replicas) return 'no-data';
  if (replicas.desired === 0) return 'scaled-to-zero';
  if (replicas.available < replicas.desired) return 'degraded';
  if (errorRatePercent !== null && errorRatePercent >= ERROR_RATE_DEGRADED_PERCENT) {
    return 'degraded';
  }
  return 'healthy';
}

export const NO_DATA = '—';

const fixed = (value: number, digits: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: digits });

export function formatRate(value: number | null): string {
  if (value === null) return NO_DATA;
  return `${fixed(value, value < 10 ? 2 : 1)} req/s`;
}

export function formatPercent(value: number | null): string {
  if (value === null) return NO_DATA;
  return `${fixed(value, value < 10 ? 1 : 0)}%`;
}

export function formatLatency(seconds: number | null): string {
  if (seconds === null) return NO_DATA;
  return seconds < 1 ? `${fixed(seconds * 1000, seconds < 0.01 ? 1 : 0)} ms` : `${fixed(seconds, 2)} s`;
}

export function formatReplicas(replicas: ObservabilitySummary['replicas']): string {
  return replicas ? `${replicas.available} / ${replicas.desired}` : NO_DATA;
}

export function formatCount(value: number | null): string {
  return value === null ? NO_DATA : String(value);
}
