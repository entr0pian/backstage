import { useState } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Tooltip from '@material-ui/core/Tooltip';
import {
  EmptyState,
  InfoCard,
  Progress,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  StatusPending,
  StatusWarning,
  StructuredMetadataTable,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { kubernetesProxyPermission } from '@backstage/plugin-kubernetes-common';
import { usePermission } from '@backstage/plugin-permission-react';
import { argoApplicationUrl, type Deployment } from './joinDeployments';
import { useDeployments } from './useDeployments';
import { LogsDialog } from './LogsDialog';
import { DetailsDrawer } from './DetailsDrawer';

const HealthStatus = ({ deployment }: { deployment: Deployment }) => {
  if (!deployment.argoApplicationName) {
    return <StatusPending>Pending</StatusPending>;
  }
  switch (deployment.healthStatus) {
    case 'Healthy':
      return <StatusOK>Healthy</StatusOK>;
    case 'Degraded':
    case 'Missing':
      return <StatusError>{deployment.healthStatus}</StatusError>;
    case 'Progressing':
      return <StatusPending>Progressing</StatusPending>;
    default:
      return <StatusWarning>{deployment.healthStatus}</StatusWarning>;
  }
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function metadataFor(deployment: Deployment): Record<string, string> {
  const delivery: Record<string, string> = deployment.argoApplicationName
    ? {
        Sync: deployment.syncStatus,
        Health: deployment.healthStatus,
        'Last deployed': formatTimestamp(deployment.lastDeployed),
        'Argo Application': deployment.argoApplicationName,
        Revision: deployment.revision ? deployment.revision.slice(0, 7) : '—',
        Namespace: deployment.namespace ?? '—',
      }
    : { Delivery: 'Pending — Argo CD application not found' };

  return {
    Version: deployment.version ?? '— (no Release)',
    Release: deployment.releaseName ?? '—',
    ...delivery,
  };
}

const EnvironmentCard = ({
  deployment,
  argocdUiUrl,
  logsAllowed,
  onViewDetails,
  onViewLogs,
}: {
  deployment: Deployment;
  argocdUiUrl?: string;
  logsAllowed: boolean;
  onViewDetails: () => void;
  onViewLogs: () => void;
}) => {
  const argoUrl = argoApplicationUrl(argocdUiUrl, deployment);
  return (
    <InfoCard
      title={deployment.environment}
      action={
        <Box pt={2} pr={2}>
          <HealthStatus deployment={deployment} />
        </Box>
      }
    >
      <StructuredMetadataTable dense metadata={metadataFor(deployment)} />
      <Box display="flex" justifyContent="space-between" mt={2}>
        <Box display="flex" style={{ gap: 8 }}>
          <Button
            size="small"
            color="primary"
            disabled={!deployment.argoApplicationName}
            onClick={onViewDetails}
          >
            Details
          </Button>
          <Tooltip
            title={logsAllowed ? '' : 'Sign in with GitHub to view logs'}
          >
            {/* span: a disabled button emits no events, so Tooltip needs a wrapper */}
            <span>
              <Button
                size="small"
                color="primary"
                disabled={!deployment.argoApplicationName || !logsAllowed}
                onClick={onViewLogs}
              >
                Logs
              </Button>
            </span>
          </Tooltip>
        </Box>
        {argoUrl && (
          <Button
            size="small"
            color="primary"
            href={argoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Argo CD
          </Button>
        )}
      </Box>
    </InfoCard>
  );
};

// Level 2 of BACKSTAGE_PART7.md's hierarchy: one card per environment,
// listed from Release CRs (intent) and enriched with Argo CD delivery
// state. Level 3 is each environment's Details drawer (BACKSTAGE_PART9.md
// Part A), which replaced the Argo CD plugin's embedded resource view.
// Level 4 is the "Open in Argo CD" deep link. Per-environment Logs
// (BACKSTAGE_PART8.md) open LogsDialog.
export const DeploymentsContent = ({ argocdUiUrl }: { argocdUiUrl?: string }) => {
  const { entity } = useEntity();
  const state = useDeployments(entity.metadata.name);
  const [detailsEnvironment, setDetailsEnvironment] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ environment: string; podName?: string } | null>(null);
  // Owner-only by permission policy (the Kubernetes plugin's permissions are
  // not on the guest allowlist) — the button just reflects that decision.
  const { allowed: logsAllowed } = usePermission({
    permission: kubernetesProxyPermission,
  });

  if (state.status === 'loading') {
    return <Progress />;
  }
  if (state.status === 'error') {
    return <ResponseErrorPanel error={state.error} />;
  }
  if (state.deployments.length === 0) {
    return (
      <EmptyState
        missing="data"
        title="No deployments found for this component"
        description="No Release CRs reference this component yet."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      {state.deployments.map(deployment => (
        <Grid item xs={12} md={6} key={deployment.environment}>
          <EnvironmentCard
            deployment={deployment}
            argocdUiUrl={argocdUiUrl}
            logsAllowed={logsAllowed}
            onViewDetails={() => setDetailsEnvironment(deployment.environment)}
            onViewLogs={() => setLogs({ environment: deployment.environment })}
          />
        </Grid>
      ))}
      <DetailsDrawer
        component={entity.metadata.name}
        deployment={
          state.deployments.find(d => d.environment === detailsEnvironment) ?? null
        }
        argocdUiUrl={argocdUiUrl}
        logsAllowed={logsAllowed}
        onClose={() => setDetailsEnvironment(null)}
        onViewLogs={(environment, podName) => setLogs({ environment, podName })}
      />
      <LogsDialog
        component={entity.metadata.name}
        environment={logs?.environment ?? ''}
        initialPodName={logs?.podName}
        open={logs !== null}
        onClose={() => setLogs(null)}
      />
    </Grid>
  );
};
