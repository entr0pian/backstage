// Mirrors the backend's ObservabilitySummary
// (packages/backend/src/modules/observabilitySummary/ObservabilitySummary.ts).
// null = no data (no traffic, no limit, no deployment), never 0.
export type Point = [unixSeconds: number, value: number];

export type SeriesKey =
  | 'requestRate'
  | 'errorRatePercent'
  | 'p95LatencySeconds'
  | 'cpuUtilizationPercent'
  | 'memoryUtilizationPercent';

export interface ObservabilitySummary {
  component: string;
  environment: string;
  generatedAt: string;
  // Window of the rate/latency values, e.g. "2m".
  rateWindow: string;
  requestRate: number | null;
  errorRatePercent: number | null;
  p95LatencySeconds: number | null;
  cpuUtilizationPercent: number | null;
  memoryUtilizationPercent: number | null;
  replicas: { available: number; desired: number } | null;
  restarts1h: number | null;
  // Metrics whose query failed (as opposed to returning no data).
  unavailable: string[];
  // Last 30 minutes per metric, for the sparklines.
  series: { stepSeconds: number; points: Record<SeriesKey, Point[]> };
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
  return replicas ? `${replicas.available} / ${replicas.desired} ready` : NO_DATA;
}

export function formatCount(value: number | null): string {
  return value === null ? NO_DATA : String(value);
}
