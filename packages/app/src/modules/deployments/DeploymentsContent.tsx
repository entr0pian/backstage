import { useState, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import LinearProgress from '@material-ui/core/LinearProgress';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import UndoIcon from '@material-ui/icons/Undo';
import { makeStyles } from '@material-ui/core/styles';
import { displayFont } from '../theme/themes';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import RocketIcon from '@material-ui/icons/FlightTakeoff';
import {
  Link,
  LinkButton,
  Progress,
  ResponseErrorPanel,
  StatusAborted,
  StatusError,
  StatusOK,
  StatusPending,
  StatusRunning,
  StatusWarning,
} from '@backstage/core-components';
import { taskCreatePermission } from '@backstage/plugin-scaffolder-common/alpha';
import { useEntity } from '@backstage/plugin-catalog-react';
import { kubernetesProxyPermission } from '@backstage/plugin-kubernetes-common';
import { usePermission } from '@backstage/plugin-permission-react';
import { type Deployment } from './joinDeployments';
import { argoApplicationUrl, useArgocdUiUrl } from '../platformUi/argocd';
import { useLiveDeployments } from './useLiveDeployments';
import type { EnvironmentDetails } from './useEnvironmentDetails';
import { phaseLabel, problemLabel, rolloutBar, rolloutLine, timingTile } from './progressView';
import { useComponentVersions, type ComponentVersions } from './useComponentVersions';
import { whatChanged, type CommitRef } from './whatChanged';
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
  rolloutLine: { fontFamily: 'monospace', fontSize: '0.9rem' },
  change: { display: 'flex', flexDirection: 'column', gap: theme.spacing(0.5), fontSize: '0.875rem' },
  changeRow: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: theme.spacing(1) },
  sha: { fontFamily: 'monospace', fontWeight: 600 },
  commitMessage: { fontWeight: 600 },
  muted: { color: theme.palette.text.secondary, fontSize: '0.8rem' },
  changeActions: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: theme.spacing(2) },
  compare: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' },
  rolloutBar: { height: 6, borderRadius: 3, margin: theme.spacing(1, 0) },
  // Backstage's StatusRunning icon is static; spin it so an in-flight
  // rollout doesn't look frozen between polls.
  '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
  spinning: {
    '& svg': { animation: '$spin 1.2s linear infinite' },
    '@media (prefers-reduced-motion: reduce)': { '& svg': { animation: 'none' } },
  },
  problem: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    fontSize: '0.85rem',
  },
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

function rolloutContext(details: EnvironmentDetails | undefined): string | undefined {
  if (!details) return undefined;
  if (!details.cluster.reachable) return 'Workload cluster unavailable';
  const { target, desiredReplicas } = details.progress;
  return target ? `${target.ready} / ${desiredReplicas} ready` : undefined;
}

// The rollout phase (backend DeploymentProgress) as a status indicator.
// Unknown is grey, never red: an unreachable cluster isn't a failed deploy.
const PhaseStatus = ({ details }: { details: EnvironmentDetails }) => {
  const classes = useStyles();
  const label = phaseLabel(details.progress, details.cluster.reachable);
  switch (details.progress.phase) {
    case 'Healthy':
      return <StatusOK>{label}</StatusOK>;
    case 'Pending':
      return <StatusPending>{label}</StatusPending>;
    case 'RollingOut':
      return (
        <span className={classes.spinning}>
          <StatusRunning>{label}</StatusRunning>
        </span>
      );
    case 'Stalled':
      return <StatusWarning>{label}</StatusWarning>;
    case 'RolloutFailed':
      return <StatusError>{label}</StatusError>;
    default:
      return <StatusAborted>{label}</StatusAborted>;
  }
};

const Sha = ({ commit }: { commit: CommitRef }) => {
  const classes = useStyles();
  return commit.url ? (
    <Link to={commit.url} className={classes.sha}>
      {commit.shortSha}
    </Link>
  ) : (
    <span className={classes.sha}>{commit.shortSha}</span>
  );
};

// What the environment's current deployment changed: the target commit,
// the version it replaced, and a GitHub compare between them (whatChanged.ts).
const WhatChangedSection = ({
  progress,
  versions,
  previousKnown,
  rollbackHref,
}: {
  progress: Pick<EnvironmentDetails['progress'], 'targetVersion' | 'previous'>;
  versions: ComponentVersions;
  // False until the workload cluster has been read (or when it can't be):
  // then "no previous version" means "don't know", not "first deployment".
  previousKnown: boolean;
  // Builds the Create deployment link for rolling back to `sha`; absent
  // for viewers who can't deploy.
  rollbackHref?: (sha: string) => string;
}) => {
  const classes = useStyles();
  const change = whatChanged(progress, versions.versions, versions.repository);
  if (!change) {
    return null;
  }
  const { target, previous } = change;
  const when = timeAgo(target.createdAt);
  let replaces: ReactNode = previousKnown ? 'First deployment to this environment' : null;
  if (change.configurationOnly) {
    replaces = 'Configuration change · same version, new revision';
  } else if (previous) {
    replaces = (
      <>
        Replaces <Sha commit={previous} />
        {previous.message && ` ${previous.message}`}
      </>
    );
  }
  return (
    <>
      <Typography className={classes.section}>What changed</Typography>
      <div className={classes.change}>
        <div className={classes.changeRow}>
          <Sha commit={target} />
          <span className={classes.commitMessage}>{target.message ?? 'Commit details unavailable'}</span>
          <span className={classes.changeActions}>
            {change.compareUrl && (
              <Link to={change.compareUrl} className={classes.compare}>
                Compare changes <OpenInNewIcon fontSize="inherit" />
              </Link>
            )}
            {rollbackHref && previous && /^[0-9a-f]{40}$/.test(previous.sha) && (
              // Opens Create deployment pre-filled; nothing ships until its PR merges.
              <LinkButton to={rollbackHref(previous.sha)} size="small" variant="outlined" color="primary" startIcon={<UndoIcon />}>
                Roll back to {previous.shortSha}
              </LinkButton>
            )}
          </span>
        </div>
        <div className={classes.muted}>
          {[target.author, when && `committed ${when}`].filter(Boolean).join(' · ')}
          {(target.author || when) && replaces && ' · '}
          {replaces}
        </div>
      </div>
    </>
  );
};

// Shown while a deployment is in flight or has failed: where it is, what's
// still serving, and what's wrong with the new pods. Healthy stays compact.
const RolloutSection = ({
  details,
  logsAllowed,
  onViewLogs,
}: {
  details: EnvironmentDetails;
  logsAllowed: boolean;
  onViewLogs: (podName: string) => void;
}) => {
  const classes = useStyles();
  const { progress } = details;
  const bar = rolloutBar(progress);
  return (
    <>
      <Typography className={classes.section}>Rollout</Typography>
      <Typography className={classes.rolloutLine}>{rolloutLine(progress)}</Typography>
      {bar && (
        // While rolling out, the buffer variant animates: solid = available,
        // light = ready but still starting, moving dots = still to come.
        <LinearProgress
          className={classes.rolloutBar}
          variant={progress.phase === 'RollingOut' ? 'buffer' : 'determinate'}
          value={bar.available}
          valueBuffer={bar.ready}
          color={progress.phase === 'RollingOut' ? 'primary' : 'secondary'}
        />
      )}
      {progress.problems.map(p => (
        <div key={p.pod} className={classes.problem}>
          <StatusWarning>{problemLabel(p.kind, p.reason)}</StatusWarning>
          <span style={{ fontFamily: 'monospace' }}>{p.pod}</span>
          {logsAllowed && (
            <Button size="small" color="primary" onClick={() => onViewLogs(p.pod)}>
              Logs
            </Button>
          )}
        </div>
      ))}
    </>
  );
};

const EnvironmentCard = ({
  deployment,
  component,
  canDeploy,
  versions,
  details,
  argocdUiUrl,
  logsAllowed,
  onViewDetails,
  onViewLogs,
}: {
  deployment: Deployment;
  component: string;
  canDeploy: boolean;
  versions: ComponentVersions;
  // This environment's summary (rollout progress); absent without a Release
  // or until it first loads, when the card falls back to Argo CD health.
  details?: EnvironmentDetails;
  argocdUiUrl?: string;
  logsAllowed: boolean;
  onViewDetails: () => void;
  onViewLogs: (podName?: string) => void;
}) => {
  const classes = useStyles();
  const pending = !deployment.argoApplicationName;
  const argoUrl = argoApplicationUrl(argocdUiUrl, {
    name: deployment.argoApplicationName,
    namespace: deployment.argoApplicationNamespace,
  });
  const progress = details?.progress;
  const timing = progress ? timingTile(progress) : null;
  // A roll back keeps what the Release binds today (database, ...).
  const bindings = Object.fromEntries(
    (details?.bindings ?? [])
      .filter(b => b.declaredByRelease && b.providerRef)
      .map(b => [b.name, b.providerRef!.name]),
  );
  const rollbackHref = canDeploy
    ? (version: string) => createDeploymentHref(component, { environment: deployment.environment, version, bindings })
    : undefined;

  return (
    <PlatformEnvironmentCard
      environment={deployment.environment}
      action={
        <Box pt={2} pr={2}>
          {details ? <PhaseStatus details={details} /> : <HealthStatus status={deployment.healthStatus} pending={pending} />}
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
            label="Rollout"
            value={details ? <PhaseStatus details={details} /> : '—'}
            context={rolloutContext(details)}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Tile
            label="Argo CD"
            value={<SyncStatus status={deployment.syncStatus} pending={pending} />}
            context={pending ? 'Application not found' : `Health: ${deployment.healthStatus}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {timing ? (
            <Tile label={timing.label} value={timing.value} context={timing.context ?? undefined} />
          ) : (
            // Rollout state unknown: fall back to Argo CD's last sync.
            <Tile
              label="Last synced"
              value={timeAgo(deployment.lastDeployed) ?? '—'}
              context={formatTimestamp(deployment.lastDeployed)}
            />
          )}
        </Grid>
      </Grid>

      <WhatChangedSection
        progress={progress ?? { targetVersion: deployment.version, previous: null }}
        versions={versions}
        previousKnown={!!progress && progress.phase !== 'Unknown'}
        rollbackHref={rollbackHref}
      />

      {details && progress && progress.phase !== 'Healthy' && progress.phase !== 'Unknown' && (
        <RolloutSection details={details} logsAllowed={logsAllowed} onViewLogs={onViewLogs} />
      )}

      <Typography className={classes.section}>Details</Typography>
      <div className={classes.details}>
        <span>
          <span className={classes.detailKey}>Cluster</span>
          {details?.cluster.name ?? '—'}
        </span>
        <span>
          <span className={classes.detailKey}>Argo Application</span>
          {deployment.argoApplicationName ?? '—'}
        </span>
      </div>

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
                onClick={() => onViewLogs()}
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
  const state = useLiveDeployments(entity.metadata.name);
  // Every SHA the cards show (each environment's target and previous), so
  // the versions list is refetched when a new deploy isn't in it yet.
  const versions = useComponentVersions(
    entity.metadata.name,
    Object.values(state.summaries).flatMap(s => [s.progress.targetVersion, s.progress.previous?.version]),
  );
  const [detailsEnvironment, setDetailsEnvironment] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ environment: string; podName?: string } | null>(null);
  // Owner-only by permission policy (the Kubernetes plugin's permissions are
  // not on the guest allowlist) — the button just reflects that decision.
  const { allowed: logsAllowed } = usePermission({
    permission: kubernetesProxyPermission,
  });
  // Deploying runs a scaffolder template, which guests can't.
  const { allowed: canDeploy } = usePermission({ permission: taskCreatePermission });

  if (!state.deployments) {
    return state.error ? <ResponseErrorPanel error={state.error} /> : <Progress />;
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
            component={entity.metadata.name}
            canDeploy={canDeploy}
            versions={versions}
            details={state.summaries[deployment.environment]}
            argocdUiUrl={argocdUiUrl}
            logsAllowed={logsAllowed}
            onViewDetails={() => setDetailsEnvironment(deployment.environment)}
            onViewLogs={podName => setLogs({ environment: deployment.environment, podName })}
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
