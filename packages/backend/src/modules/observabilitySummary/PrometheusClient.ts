// Minimal query client for the cluster-internal Prometheus. Only
// ObservabilitySummary calls it, with its own fixed queries — there is no
// route that forwards a caller's PromQL here.

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

export class PrometheusClient implements PrometheusQueryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5000,
  ) {}

  private async request<T>(
    path: string,
    params: Record<string, string>,
    resultType: string,
  ): Promise<T[]> {
    const res = await fetch(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
