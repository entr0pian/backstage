// Minimal client for a Prometheus-compatible query API: in the cluster,
// Mimir's in-cluster query-frontend (the central store every environment's
// Prometheus remote-writes to); a plain Prometheus works too, e.g. locally.
// Only ObservabilitySummary calls it, with its own fixed queries; no route
// forwards a caller's PromQL here.

// [unix seconds, value]
export type Point = [number, number];

export interface PrometheusQueryClient {
  // One sample's value, or null when the query returned no series.
  queryScalar(promql: string): Promise<number | null>;
  // The first series' points over [start, end], or [] when there's none.
  // Steps with no value (e.g. no traffic) are simply absent.
  queryRange(promql: string, start: number, end: number, step: number): Promise<Point[]>;
}

interface PrometheusResponse<T> {
  status: 'success' | 'error';
  error?: string;
  data?: { resultType: string; result: T[] };
}

export interface PrometheusClientOptions {
  // Sent as X-Scope-OrgID on every query: the Mimir tenant to read. Leave
  // unset for a plain Prometheus, which has no tenants.
  tenant?: string;
  timeoutMs?: number;
}

export class PrometheusClient implements PrometheusQueryClient {
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  // baseUrl is what /api/v1/query is appended to: http://host:9090 for
  // Prometheus, http://host:8080/prometheus for Mimir.
  constructor(
    private readonly baseUrl: string,
    { tenant, timeoutMs = 5000 }: PrometheusClientOptions = {},
  ) {
    this.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (tenant) {
      this.headers['X-Scope-OrgID'] = tenant;
    }
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(
    path: string,
    params: Record<string, string>,
    resultType: string,
  ): Promise<T[]> {
    const res = await fetch(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Prometheus query failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as PrometheusResponse<T>;
    if (body.status !== 'success' || body.data?.resultType !== resultType) {
      throw new Error(`Prometheus query failed: ${body.error ?? 'unexpected response'}`);
    }
    return body.data.result;
  }

  async queryScalar(promql: string): Promise<number | null> {
    const [first] = await this.request<{ value: [number, string] }>(
      '/api/v1/query',
      { query: promql },
      'vector',
    );
    if (!first) {
      return null;
    }
    const value = Number(first.value[1]);
    return Number.isFinite(value) ? value : null;
  }

  async queryRange(promql: string, start: number, end: number, step: number): Promise<Point[]> {
    const [first] = await this.request<{ values: [number, string][] }>(
      '/api/v1/query_range',
      { query: promql, start: String(start), end: String(end), step: String(step) },
      'matrix',
    );
    return (first?.values ?? [])
      .map(([t, v]): Point => [t, Number(v)])
      .filter(([, v]) => Number.isFinite(v));
  }
}
