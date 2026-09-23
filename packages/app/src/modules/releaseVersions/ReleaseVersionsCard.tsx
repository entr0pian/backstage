import { useEffect, useState } from 'react';
import {
  EmptyState,
  InfoCard,
  Progress,
  ResponseErrorPanel,
  Table,
  type TableColumn,
} from '@backstage/core-components';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';

interface ReleaseVersion {
  environment: string;
  version: string;
}

interface ReleasesResponse {
  component: string;
  releases: ReleaseVersion[];
}

const columns: TableColumn<ReleaseVersion>[] = [
  { title: 'Environment', field: 'environment' },
  { title: 'Version', field: 'version' },
];

// Independent of the Argo CD plugin's own tabs — this only ever reads
// Release CRs via GET /api/platform/releases/:component, never Argo CD. See
// BACKSTAGE_PART5.md's "Architecture" section for why the two are
// deliberately not joined.
export const ReleaseVersionsCard = () => {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; error: Error }
    | { status: 'done'; releases: ReleaseVersion[] }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState({ status: 'loading' });
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(
          `${baseUrl}/releases/${encodeURIComponent(entity.metadata.name)}`,
        );
        if (!res.ok) {
          throw new Error(`Release Versions request failed: ${res.status} ${res.statusText}`);
        }
        const body: ReleasesResponse = await res.json();
        if (!cancelled) {
          setState({ status: 'done', releases: body.releases });
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
    <InfoCard title="Release Versions">
      {state.status === 'loading' && <Progress />}
      {state.status === 'error' && <ResponseErrorPanel error={state.error} />}
      {state.status === 'done' && state.releases.length === 0 && (
        <EmptyState
          missing="data"
          title="No deployments found for this component"
          description="No Release CRs reference this component yet."
        />
      )}
      {state.status === 'done' && state.releases.length > 0 && (
        <Table
          options={{ search: false, paging: false, padding: 'dense' }}
          columns={columns}
          data={state.releases}
        />
      )}
    </InfoCard>
  );
};
