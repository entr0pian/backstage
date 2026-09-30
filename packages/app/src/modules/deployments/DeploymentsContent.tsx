import { useState, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import { displayFont } from '../theme/themes';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import RocketIcon from '@material-ui/icons/FlightTakeoff';
import { LinkButton, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { taskCreatePermission } from '@backstage/plugin-scaffolder-common/alpha';
import { useEntity } from '@backstage/plugin-catalog-react';
import { kubernetesProxyPermission } from '@backstage/plugin-kubernetes-common';
import { usePermission } from '@backstage/plugin-permission-react';
import { type Deployment } from './joinDeployments';
import { argoApplicationUrl, useArgocdUiUrl } from '../platformUi/argocd';
import { useDeployments } from './useDeployments';
import { LogsDialog } from './LogsDialog';
import { DetailsDrawer } from './DetailsDrawer';
import {
  EnvironmentCard as PlatformEnvironmentCard,
  HealthStatus,
  PlatformEmptyState,
  SyncStatus,
  shortVersion,
  timeAgo,
} from '../platformUi';
import { createDeploymentHref } from '../platformActions/createDeploymentHref';

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const useStyles = makeStyles(theme => ({
  // Same tile language as the Metrics tab: label, big value, context line.
  tile: {
    height: '100%',
    padding: theme.spacing(2, 2, 1.5),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
    transition: 'transform 200ms cubic-bezier(.34,1.56,.64,1), border-color 200ms ease, background-color 200ms ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.background.paper,
    },
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: displayFont,
    fontSize: '1.3rem',
    fontWeight: 700,
    lineHeight: 1.4,
    marginTop: theme.spacing(0.5),
    minHeight: 34,
    display: 'flex',
    alignItems: 'center',
    '& .MuiTypography-root': { fontSize: 'inherit' },
  },
  mono: { fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 600 },
  context: {
    marginTop: theme.spacing(0.5),
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  section: {
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: '0.68rem',
    fontWeight: 700,
    margin: theme.spacing(3, 0, 1),
  },
  details: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1, 4),
    fontSize: '0.85rem',
  },
  detailKey: { color: theme.palette.text.secondary, marginRight: theme.spacing(1) },
  history: { listStyle: 'none', margin: 0, padding: 0 },
  historyItem: {
    display: 'grid',
    gridTemplateColumns: '16px 90px 1fr auto',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.75, 0),
    fontSize: '0.85rem',
    '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
  },
  historyDot: { width: 8, height: 8, borderRadius: '50%', justifySelf: 'center' },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
}));

const Tile = ({ label, value, context }: { label: string; value: ReactNode; context?: ReactNode }) => {
  const classes = useStyles();
  return (
    <Box className={classes.tile}>
      <Typography className={classes.label}>{label}</Typography>
      <div className={classes.value}>{value}</div>
      <div className={classes.context}>{context ?? '\u00a0'}</div>
    </Box>
  );
};

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
  const classes = useStyles();
  const theme = useTheme();
  const pending = !deployment.argoApplicationName;
  const argoUrl = argoApplicationUrl(argocdUiUrl, {
    name: deployment.argoApplicationName,
    namespace: deployment.argoApplicationNamespace,
  });
  const current = deployment.revision;

  return (
    <PlatformEnvironmentCard
      environment={deployment.environment}
      action={
        <Box pt={2} pr={2}>
          <HealthStatus status={deployment.healthStatus} pending={pending} />
        </Box>
      }
    >
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} sm={6} md={3}>
          <Tile
            label="Version"
            value={
              deployment.version ? (
                <Tooltip title={deployment.version}>
                  <span className={classes.mono}>{shortVersion(deployment.version)}</span>
                </Tooltip>
              ) : (
                '—'
              )
            }
            context={deployment.releaseName ? `Release ${deployment.releaseName}` : 'No Release'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Tile
            label="Sync"
            value={<SyncStatus status={deployment.syncStatus} pending={pending} />}
            context={pending ? 'Argo CD application not found' : `Argo CD · ${deployment.argoApplicationName}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Tile
            label="Health"
            value={<HealthStatus status={deployment.healthStatus} pending={pending} />}
            context="Argo CD resource health"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Tile
            label="Last deployed"
            value={timeAgo(deployment.lastDeployed) ?? '—'}
            context={formatTimestamp(deployment.lastDeployed)}
          />
        </Grid>
      </Grid>

      <Typography className={classes.section}>Details</Typography>
      <div className={classes.details}>
        <span>
          <span className={classes.detailKey}>Namespace</span>
          {deployment.namespace ?? '—'}
        </span>
        <span>
          <span className={classes.detailKey}>Revision</span>
          <span style={{ fontFamily: 'monospace' }}>{current ? current.slice(0, 7) : '—'}</span>
        </span>
        <span>
          <span className={classes.detailKey}>Argo Application</span>
          {deployment.argoApplicationName ?? '—'}
        </span>
      </div>

      {deployment.history.length > 0 && (
        <>
          <Typography className={classes.section}>Recent syncs</Typography>
          <ul className={classes.history}>
            {deployment.history.map((h, i) => {
              const isCurrent = i === 0;
              return (
                <li key={`${h.revision}-${h.deployedAt}`} className={classes.historyItem}>
                  <span
                    className={classes.historyDot}
                    style={{ backgroundColor: isCurrent ? theme.palette.success.main : theme.palette.divider }}
                  />
                  <span style={{ fontFamily: 'monospace' }}>{h.revision ? h.revision.slice(0, 7) : '—'}</span>
                  <Typography variant="body2" color={isCurrent ? 'textPrimary' : 'textSecondary'} component="span">
                    {isCurrent ? 'Current' : 'Previous'}
                  </Typography>
                  <Tooltip title={formatTimestamp(h.deployedAt)}>
                    <Typography variant="body2" color="textSecondary" component="span">
                      {timeAgo(h.deployedAt) ?? '—'}
                    </Typography>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className={classes.footer}>
        <Box display="flex" style={{ gap: 8 }}>
          <Button size="small" color="primary" variant="outlined" disabled={pending} onClick={onViewDetails}>
            Details
          </Button>
          <Tooltip title={logsAllowed ? '' : 'Sign in with GitHub to view logs'}>
            {/* span: a disabled button emits no events, so Tooltip needs a wrapper */}
            <span>
              <Button
                size="small"
                color="primary"
                variant="outlined"
                disabled={pending || !logsAllowed}
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
            endIcon={<OpenInNewIcon fontSize="small" />}
          >
            Open in Argo CD
          </Button>
        )}
      </div>
    </PlatformEnvironmentCard>
  );
};

// Level 2 of BACKSTAGE_PART7.md's hierarchy: one card per environment,
// listed from Release CRs (intent) and enriched with Argo CD delivery
// state. Level 3 is each environment's Details drawer (BACKSTAGE_PART9.md
// Part A), which replaced the Argo CD plugin's embedded resource view.
// Level 4 is the "Open in Argo CD" deep link. Per-environment Logs
// (BACKSTAGE_PART8.md) open LogsDialog.
export const DeploymentsContent = () => {
  const { entity } = useEntity();
  const argocdUiUrl = useArgocdUiUrl();
  const state = useDeployments(entity.metadata.name);
  const [detailsEnvironment, setDetailsEnvironment] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ environment: string; podName?: string } | null>(null);
  // Owner-only by permission policy (the Kubernetes plugin's permissions are
  // not on the guest allowlist) — the button just reflects that decision.
  const { allowed: logsAllowed } = usePermission({
    permission: kubernetesProxyPermission,
  });
  // Deploying runs a scaffolder template, which guests can't.
  const { allowed: canDeploy } = usePermission({ permission: taskCreatePermission });

  if (state.status === 'loading') {
    return <Progress />;
  }
  if (state.status === 'error') {
    return <ResponseErrorPanel error={state.error} />;
  }
  if (state.deployments.length === 0) {
    return (
      <PlatformEmptyState
        icon={<RocketIcon />}
        title="Not deployed yet"
        description="No Release references this component. Pick a version and an environment to ship it."
        action={
          canDeploy && (
            <LinkButton
              to={createDeploymentHref(entity.metadata.name)}
              color="primary"
              variant="contained"
              startIcon={<CloudUploadIcon />}
            >
              Create deployment
            </LinkButton>
          )
        }
      />
    );
  }

  return (
    <Grid container spacing={3}>
      {state.deployments.map(deployment => (
        <Grid item xs={12} key={deployment.environment}>
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
