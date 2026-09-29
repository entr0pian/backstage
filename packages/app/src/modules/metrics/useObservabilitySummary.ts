import { useEffect, useState } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import type { ObservabilitySummary } from './summary';

export type ObservabilitySummaryState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'done'; summary: ObservabilitySummary };

// One environment's golden signals from the platform backend's fixed-query
// route — the browser sends only the component and environment. Each card
// fetches on its own, so one failing environment doesn't blank the others.
export function useObservabilitySummary(
  component: string,
  environment: string,
): ObservabilitySummaryState {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [state, setState] = useState<ObservabilitySummaryState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ status: 'loading' });
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(
          `${baseUrl}/observability/components/${encodeURIComponent(component)}/environments/${encodeURIComponent(environment)}`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Metrics request failed: ${res.status} ${res.statusText}`);
        }
        const summary: ObservabilitySummary = await res.json();
        if (!cancelled) setState({ status: 'done', summary });
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error: error as Error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi, component, environment]);

  return state;
}
