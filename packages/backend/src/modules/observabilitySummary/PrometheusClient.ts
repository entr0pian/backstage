// Minimal instant-query client for the cluster-internal Prometheus. Only
// ObservabilitySummary calls it, with its own fixed queries — there is no
// route that forwards a caller's PromQL here.

export interface InstantQueryClient {
  // One sample's value, or null when the query returned no series.
  queryScalar(promql: string): Promise<number | null>;
}

interface PrometheusVectorResponse {
  status: 'success' | 'error';
  error?: string;
  data?: {
    resultType: string;
    result: { value: [number, string] }[];
  };
}

export class PrometheusClient implements InstantQueryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 5000,
  ) {}

  async queryScalar(promql: string): Promise<number | null> {
    const res = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/api/v1/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query: promql }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Prometheus query failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as PrometheusVectorResponse;
    if (body.status !== 'success' || body.data?.resultType !== 'vector') {
      throw new Error(`Prometheus query failed: ${body.error ?? 'unexpected response'}`);
    }
    const [first] = body.data.result;
    if (!first) {
      return null;
    }
    const value = Number(first.value[1]);
    return Number.isFinite(value) ? value : null;
  }
}
