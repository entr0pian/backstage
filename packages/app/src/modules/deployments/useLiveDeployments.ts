import { useEffect, useState } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import type { Deployment } from './joinDeployments';
import { loadDeployments } from './useDeployments';
import type { EnvironmentDetails } from './useEnvironmentDetails';
import { IDLE_INTERVAL_MS, pollInterval } from './progressView';
import { useEnvironmentOrder } from '../platformUi/environments';

export interface LiveDeploymentsState {
  // The latest successful load; kept while refreshing and after a failed
  // refresh, so the cards never blank between polls.
  deployments: Deployment[] | null;
  // Per environment: its latest environment summary (rollout progress
  // included). An environment whose summary failed keeps its previous one.
  summaries: Record<string, EnvironmentDetails>;
  error: Error | null;
  loading: boolean;
}

// The Deployments tab's data: Release + Argo CD (loadDeployments) and, for
// every environment with a Release, its environment summary, refreshed
// together on one timer — fast while any environment is mid-deployment,
// slow otherwise (progressView.ts). Same rules as the Metrics tab's polling:
// paused while the browser tab is hidden, refreshed as soon as it's visible
// again, never two refreshes at once.
export function useLiveDeployments(component: string): LiveDeploymentsState {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const environmentOrder = useEnvironmentOrder();
  const orderKey = environmentOrder.join(',');
  const [state, setState] = useState<LiveDeploymentsState>({
    deployments: null,
    summaries: {},
    error: null,
    loading: true,
  });
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let interval = IDLE_INTERVAL_MS;
    let lastSummaries: Record<string, EnvironmentDetails> = {};
    let inFlight = false;

    const loadSummary = async (environment: string): Promise<EnvironmentDetails | null> => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(
          `${baseUrl}/environments/${encodeURIComponent(component)}/${encodeURIComponent(environment)}`,
        );
        return res.ok ? ((await res.json()) as EnvironmentDetails) : null;
      } catch {
        return null;
      }
    };

    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const deployments = await loadDeployments(
          discoveryApi,
          fetchApi,
          component,
          orderKey ? orderKey.split(',') : [],
        );
        const released = deployments.filter(d => d.releaseName).map(d => d.environment);
        const loaded = await Promise.all(released.map(loadSummary));
        if (cancelled) return;
        const summaries: Record<string, EnvironmentDetails> = {};
        released.forEach((environment, i) => {
          const summary = loaded[i] ?? lastSummaries[environment];
          if (summary) summaries[environment] = summary;
        });
        lastSummaries = summaries;
        interval = pollInterval(Object.values(summaries).map(s => s.progress.phase));
        setState({ deployments, summaries, error: null, loading: false });
      } catch (error) {
        if (!cancelled) {
          setState(prev => ({ ...prev, error: error as Error, loading: false }));
        }
      } finally {
        inFlight = false;
      }
    };

    const schedule = () => {
      timer = setTimeout(async () => {
        if (!document.hidden) await refresh();
        if (!cancelled) schedule();
      }, interval);
    };

    const onVisible = () => {
      if (!document.hidden) refresh();
    };

    setState({ deployments: null, summaries: {}, error: null, loading: true });
    refresh().then(() => !cancelled && schedule());
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [discoveryApi, fetchApi, component, orderKey]);

  return state;
}
