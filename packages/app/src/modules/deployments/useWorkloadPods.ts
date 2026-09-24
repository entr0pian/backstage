import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { kubernetesApiRef } from '@backstage/plugin-kubernetes-react';
import {
  sortWorkloadPods,
  toWorkloadPods,
  workloadPodSelector,
  type KubernetesPod,
  type WorkloadPod,
} from './workloadPods';

export type WorkloadPodsState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'done'; pods: WorkloadPod[] };

// Lists one component's pods in one environment, across every cluster the
// Kubernetes backend knows about and every namespace — the label selector
// alone decides what belongs, so nothing here assumes a single cluster or
// namespace-per-environment. Uses the Kubernetes plugin's own API client
// (and so its backend, auth and permission checks); only runs while the
// Logs dialog is open.
export function useWorkloadPods(
  component: string,
  environment: string,
  enabled: boolean,
): WorkloadPodsState {
  const kubernetesApi = useApi(kubernetesApiRef);
  const [state, setState] = useState<WorkloadPodsState>({ status: 'loading' });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let cancelled = false;

    (async () => {
      setState({ status: 'loading' });
      try {
        const clusters = await kubernetesApi.getClusters();
        const selector = encodeURIComponent(workloadPodSelector(component, environment));
        const perCluster = await Promise.all(
          clusters.map(async cluster => {
            const res = await kubernetesApi.proxy({
              clusterName: cluster.name,
              path: `/api/v1/pods?labelSelector=${selector}`,
            });
            if (!res.ok) {
              throw new Error(
                `Listing pods in cluster "${cluster.name}" failed: ${res.status} ${res.statusText}`,
              );
            }
            const body: { items?: KubernetesPod[] } = await res.json();
            return toWorkloadPods(cluster.name, body.items ?? []);
          }),
        );
        if (!cancelled) {
          setState({ status: 'done', pods: sortWorkloadPods(perCluster.flat()) });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', error: error as Error });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kubernetesApi, component, environment, enabled]);

  return state;
}
