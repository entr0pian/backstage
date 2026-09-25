import { useEffect, useState } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  joinDeployments,
  type ArgoApplication,
  type Deployment,
  type ReleaseVersion,
} from './joinDeployments';
import { fetchArgoApplications } from '../platformUi/argocd';

export type DeploymentsState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'done'; deployments: Deployment[] };

// Two independent fetches, joined client-side — never a second Argo CD
// client. Version/Environment/Release come from our own /api/platform/releases
// route (see backend's modules/releaseVersions/). Delivery state comes from
// @backstage-community/plugin-argocd-backend's own already-installed
// endpoint — see platform-architecture/BACKSTAGE_PART6.md. Shared by the
// Overview card and the Deployments tab so both always agree.
export function useDeployments(component: string): DeploymentsState {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [state, setState] = useState<DeploymentsState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState({ status: 'loading' });
      try {
        const platformBaseUrl = await discoveryApi.getBaseUrl('platform');

        // The component's workload Applications, found by the shared
        // platform.taskapp.io/* label contract (see platformUi/argocd.ts).
        const [releasesRes, argo] = await Promise.all([
          fetchApi.fetch(`${platformBaseUrl}/releases/${encodeURIComponent(component)}`),
          fetchArgoApplications<ArgoApplication>(discoveryApi, fetchApi, {
            component,
            type: 'service',
          }),
        ]);

        if (!releasesRes.ok) {
          throw new Error(`Release Versions request failed: ${releasesRes.status} ${releasesRes.statusText}`);
        }
        const releasesBody: { releases: ReleaseVersion[] } = await releasesRes.json();

        // Argo CD connectivity is allowed to fail independently — still
        // show Release-derived deployments with Sync/Health as Unknown
        // rather than losing the whole view, per BACKSTAGE_PART5.md's
        // "Argo unavailable" behavior, carried over here.
        const argoApps = argo.items;

        if (!cancelled) {
          setState({
            status: 'done',
            deployments: joinDeployments(releasesBody.releases, argoApps),
          });
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
  }, [discoveryApi, fetchApi, component]);

  return state;
}
