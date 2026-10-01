import { useCallback, useEffect, useRef, useState } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import type { ObservabilitySummary } from './summary';

// Prometheus scrapes services every 30s and remote-writes to Mimir within
// seconds; polling at half the scrape interval means a new scrape shows up
// here within ~15s of Mimir having it. Faster buys nothing but load.
export const REFRESH_INTERVAL_MS = 15_000;

export interface ObservabilitySummaryState {
  // The latest successful response; kept while refreshing and after a
  // failed refresh, so the card never blanks between polls.
  summary: ObservabilitySummary | null;
  // The last refresh's error, cleared by the next success.
  error: Error | null;
  // When `summary` was received (ms since epoch).
  updatedAt: number | null;
  loading: boolean;
}

// One environment's golden signals from the platform backend's fixed-query
// route — the browser sends only the component and environment. Each card
// polls on its own, so one failing environment doesn't blank the others.
// Polling pauses while the browser tab is hidden and catches up as soon as
// it's visible again.
export function useObservabilitySummary(
  component: string,
  environment: string,
  intervalMs: number = REFRESH_INTERVAL_MS,
): ObservabilitySummaryState {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [state, setState] = useState<ObservabilitySummaryState>({
    summary: null,
    error: null,
    updatedAt: null,
    loading: true,
  });
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (isCancelled: () => boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
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
        if (!isCancelled()) {
          setState({ summary, error: null, updatedAt: Date.now(), loading: false });
        }
      } catch (error) {
        if (!isCancelled()) {
          setState(prev => ({ ...prev, error: error as Error, loading: false }));
        }
      } finally {
        inFlight.current = false;
      }
    },
    [discoveryApi, fetchApi, component, environment],
  );

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    setState({ summary: null, error: null, updatedAt: null, loading: true });
    refresh(isCancelled);

    const timer = setInterval(() => {
      if (!document.hidden) refresh(isCancelled);
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden) refresh(isCancelled);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, intervalMs]);

  return state;
}
