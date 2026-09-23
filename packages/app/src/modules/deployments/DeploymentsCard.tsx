import { useEffect, useState } from 'react';
import {
  EmptyState,
  InfoCard,
  Link,
  Progress,
  ResponseErrorPanel,
  Table,
  type TableColumn,
} from '@backstage/core-components';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  joinDeployments,
  type ArgoApplication,
  type Deployment,
  type ReleaseVersion,
} from './joinDeployments';

const columns: TableColumn<Deployment>[] = [
  { title: 'Environment', field: 'environment' },
  { title: 'Version', field: 'version', render: row => row.version ?? '—' },
  { title: 'Sync', field: 'syncStatus' },
  { title: 'Health', field: 'healthStatus' },
];

const ARGO_SELECTOR_LABELS = 'platform.taskapp.io/type=service';

// Two independent fetches, joined client-side — never a second Argo CD
// client. Version/Environment come from our own /api/platform/releases
// route (see backend's modules/releaseVersions/). Sync/Health come from
// @backstage-community/plugin-argocd-backend's own already-installed
// endpoint, the same one its Deployment Summary/Lifecycle tabs call — see
// platform-architecture/BACKSTAGE_PART6.md.
export const DeploymentsCard = () => {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; error: Error }
    | { status: 'done'; deployments: Deployment[] }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const component = entity.metadata.name;

    (async () => {
      setState({ status: 'loading' });
      try {
        const [platformBaseUrl, argocdBaseUrl] = await Promise.all([
          discoveryApi.getBaseUrl('platform'),
          discoveryApi.getBaseUrl('backstage-community-argocd'),
        ]);

        const selector = `platform.taskapp.io/component=${component},${ARGO_SELECTOR_LABELS}`;

        const [releasesRes, argoRes] = await Promise.all([
          fetchApi.fetch(`${platformBaseUrl}/releases/${encodeURIComponent(component)}`),
          fetchApi.fetch(
            `${argocdBaseUrl}/argoInstance/primary/applications/selector/${encodeURIComponent(selector)}`,
          ),
        ]);

        if (!releasesRes.ok) {
          throw new Error(`Release Versions request failed: ${releasesRes.status} ${releasesRes.statusText}`);
        }
        const releasesBody: { releases: ReleaseVersion[] } = await releasesRes.json();

        // Argo CD connectivity is allowed to fail independently — still
        // show Release-derived deployments with Sync/Health as Unknown
        // rather than losing the whole card, per BACKSTAGE_PART5.md's
        // "Argo unavailable" behavior, carried over here.
        let argoApps: ArgoApplication[] = [];
        if (argoRes.ok) {
          const argoBody: { items?: ArgoApplication[] } = await argoRes.json();
          argoApps = argoBody.items ?? [];
        }

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
  }, [discoveryApi, fetchApi, entity.metadata.name]);

  return (
    <InfoCard title="Deployments">
      {state.status === 'loading' && <Progress />}
      {state.status === 'error' && <ResponseErrorPanel error={state.error} />}
      {state.status === 'done' && state.deployments.length === 0 && (
        <EmptyState
          missing="data"
          title="No deployments found for this component"
          description="No Release CRs reference this component yet."
        />
      )}
      {state.status === 'done' && state.deployments.length > 0 && (
        <>
          <Table
            options={{ search: false, paging: false, padding: 'dense' }}
            columns={columns}
            data={state.deployments}
          />
          <Link to="deployment-summary">View deployments &rarr;</Link>
        </>
      )}
    </InfoCard>
  );
};
