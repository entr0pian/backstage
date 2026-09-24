import { useNavigate } from 'react-router-dom';
import {
  EmptyState,
  InfoCard,
  Link,
  Progress,
  ResponseErrorPanel,
  Table,
  type TableColumn,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { Deployment } from './joinDeployments';
import { useDeployments } from './useDeployments';

const columns: TableColumn<Deployment>[] = [
  { title: 'Environment', field: 'environment' },
  { title: 'Version', field: 'version', render: row => row.version ?? '—' },
  { title: 'Sync', field: 'syncStatus' },
  { title: 'Health', field: 'healthStatus' },
];

// Level 1 of BACKSTAGE_PART7.md's hierarchy: "where is my service deployed
// and is it healthy?" — intentionally compact. Everything else lives on
// the Deployments tab (DeploymentsContent.tsx), which this links to.
export const DeploymentsCard = () => {
  const { entity } = useEntity();
  const navigate = useNavigate();
  const state = useDeployments(entity.metadata.name);

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
            onRowClick={() => navigate('deployments')}
          />
          <Link to="deployments">View deployments &rarr;</Link>
        </>
      )}
    </InfoCard>
  );
};
