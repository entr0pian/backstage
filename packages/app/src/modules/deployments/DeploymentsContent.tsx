import { useEffect, useRef, useState, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import LinearProgress from '@material-ui/core/LinearProgress';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import CallSplitIcon from '@material-ui/icons/CallSplit';
import DescriptionIcon from '@material-ui/icons/DescriptionOutlined';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import ScheduleIcon from '@material-ui/icons/Schedule';
import SyncIcon from '@material-ui/icons/Sync';
import UndoIcon from '@material-ui/icons/Undo';
import WidgetsIcon from '@material-ui/icons/WidgetsOutlined';
import { makeStyles } from '@material-ui/core/styles';
import { displayFont } from '../theme/themes';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import RocketIcon from '@material-ui/icons/FlightTakeoff';
import {
  Link,
  LinkButton,
  Progress,
  ResponseErrorPanel,
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
import { cardActivity, isActive, problemLabel, rolloutBar, rolloutLine, timingTile } from './progressView';
import type { ProgressPhase } from './useEnvironmentDetails';
import { PhaseStatus } from './PhaseStatus';
import { RolloutSteps } from './RolloutSteps';
import { useComponentVersions, type ComponentVersions } from './useComponentVersions';
import { commitUrl, whatChanged, type CommitRef } from './whatChanged';
import { LogsDialog } from './LogsDialog';
import { DetailsDrawer } from './DetailsDrawer';
import {
  EnvironmentCard as PlatformEnvironmentCard,
  HealthStatus,
  PlatformEmptyState,
  shortVersion,
  timeAgo,
} from '../platformUi';
import { createDeploymentHref } from '../platformActions/createDeploymentHref';

const useStyles = makeStyles(theme => ({
  // One row of icon + value + label stats, divided by thin rules.
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    rowGap: theme.spacing(2),
    padding: theme.spacing(0.5, 0, 2),
  },
  stat: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0, 2),
    '&:first-child': { paddingLeft: 0 },
    '& + &': { borderLeft: `1px solid ${theme.palette.divider}` },
  },
  statIcon: { color: theme.palette.text.secondary, marginTop: 2 },
  statIconGood: { color: theme.palette.success.main, marginTop: 2 },
  statValue: {
    fontFamily: displayFont,
    fontWeight: 700,
    fontSize: '1.05rem',
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
  },
  mono: { fontFamily: 'monospace', fontWeight: 700, fontSize: '1.05rem' },
  statLabel: { color: theme.palette.text.secondary, fontSize: '0.8rem' },
  sectionLabel: { color: theme.palette.text.secondary, fontSize: '0.8rem', margin: theme.spacing(2, 0, 0.75) },
  change: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing(1.5), flexWrap: 'wrap' },
  changeText: { flex: '1 1 260px', minWidth: 0 },
  commitMessage: { fontWeight: 700, fontSize: '0.95rem' },
  sha: { fontFamily: 'monospace', fontWeight: 600 },
  muted: { color: theme.palette.text.secondary, fontSize: '0.8rem' },
  changeActions: { display: 'flex', gap: theme.spacing(1), flexWrap: 'wrap' },
  rolloutLine: { fontFamily: 'monospace', fontSize: '0.9rem' },
  rolloutBar: { height: 6, borderRadius: 3, margin: theme.spacing(1, 0) },
  problem: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    fontSize: '0.85rem',
  },
  headerAction: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 1, 0, 0),
    color: theme.palette.text.secondary,
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

// True for a moment after a rollout this page watched turns Healthy — not
// on page load, so an environment that was already healthy doesn't glow.
function useJustFinished(phase: ProgressPhase | undefined, durationMs = 2000): boolean {
  const previous = useRef<ProgressPhase | undefined>(undefined);
  const [justFinished, setJustFinished] = useState(false);
  useEffect(() => {
    const was = previous.current;
    previous.current = phase;
    if (phase !== 'Healthy' || !was || !isActive(was)) return undefined;
    setJustFinished(true);
    const timer = setTimeout(() => setJustFinished(false), durationMs);
    return () => clearTimeout(timer);
  }, [phase, durationMs]);
  return justFinished;
}

// A version as its short SHA, linking to the commit on GitHub when it's one.
const VersionLink = ({ version, repository }: { version: string; repository: string | null }) => {
  const classes = useStyles();
  const url = commitUrl(repository, version);
  const label = <span className={classes.mono}>{shortVersion(version)}</span>;
  return <Tooltip title={version}>{url ? <Link to={url}>{label}</Link> : label}</Tooltip>;
};

const Stat = ({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: ReactNode;
}) => {
  const classes = useStyles();
  return (
    <div className={classes.stat}>
      {icon}
      <div>
        <div className={classes.statValue}>{value}</div>
        <div className={classes.statLabel}>{label}</div>
      </div>
    </div>
  );
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
  let replaces: ReactNode = previousKnown ? 'first deployment to this environment' : null;
  if (change.configurationOnly) {
    replaces = 'configuration change, same version';
  } else if (previous) {
    replaces = (
      <>
        previous <Sha commit={previous} />
      </>
    );
  }
  const canRollBack = rollbackHref && previous && /^[0-9a-f]{40}$/.test(previous.sha);
  return (
    <>
      <Typography className={classes.sectionLabel}>What changed</Typography>
      <div className={classes.change}>
        <CallSplitIcon className={classes.statIcon} />
        <div className={classes.changeText}>
          <div className={classes.commitMessage}>
            {target.message ?? <Sha commit={target} />}
          </div>
          <div className={classes.muted}>
            {[target.author, when].filter(Boolean).join(' · ')}
            {(target.author || when) && replaces && ' · '}
            {replaces}
          </div>
        </div>
        <div className={classes.changeActions}>
          {change.compareUrl && (
            <Button
              size="small"
              variant="outlined"
              color="primary"
              href={change.compareUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon fontSize="small" />}
            >
              Compare changes
            </Button>
          )}
          {canRollBack && (
            // Opens Create deployment pre-filled and locked; nothing ships until its PR merges.
            <Tooltip title={`Roll back to ${previous!.shortSha}`}>
              <span>
                <LinkButton
                  to={rollbackHref!(previous!.sha)}
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<UndoIcon />}
                >
                  Rollback
                </LinkButton>
              </span>
            </Tooltip>
          )}
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
      <Typography className={classes.sectionLabel}>Rollout</Typography>
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
      {details.rolloutSteps.length > 0 && (
        <>
          <Typography className={classes.sectionLabel}>Latest steps</Typography>
          <RolloutSteps steps={details.rolloutSteps} limit={5} />
        </>
      )}
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
  const [expanded, setExpanded] = useState(true);
  const pending = !deployment.argoApplicationName;
  const argoUrl = argoApplicationUrl(argocdUiUrl, {
    name: deployment.argoApplicationName,
    namespace: deployment.argoApplicationNamespace,
  });
  const progress = details?.progress;
  const timing = progress ? timingTile(progress) : null;
  const justFinished = useJustFinished(progress?.phase);
  // A roll back keeps what the Release binds today (database, ...).
  const bindings = Object.fromEntries(
    (details?.bindings ?? [])
      .filter(b => b.declaredByRelease && b.providerRef)
      .map(b => [b.name, b.providerRef!.name]),
  );
  const rollbackHref = canDeploy
    ? (version: string) => createDeploymentHref(component, { environment: deployment.environment, version, bindings })
    : undefined;

  // "Deployed 19m ago" in the header; while something is happening, what.
  let headline: string | null = null;
  if (timing?.label === 'Rolled out') headline = `Deployed ${timing.value}`;
  else if (timing) headline = `${timing.label} ${timing.value}`;
  else if (deployment.lastDeployed) headline = `Synced ${timeAgo(deployment.lastDeployed)}`;

  let workloadValue: ReactNode = '—';
  let workloadLabel: ReactNode = 'Workload';
  if (details && !details.cluster.reachable) {
    workloadLabel = 'Workload cluster unavailable';
  } else if (progress?.target) {
    workloadValue = `${progress.target.ready} / ${progress.desiredReplicas} ready`;
  } else if (progress?.previous) {
    workloadValue = `${progress.previous.ready} / ${progress.desiredReplicas} ready`;
    workloadLabel = 'Workload · previous version';
  }

  const synced = deployment.syncStatus === 'Synced';

  return (
    <PlatformEnvironmentCard
      environment={deployment.environment}
      activity={progress ? cardActivity(progress.phase, justFinished) : undefined}
      status={
        details ? <PhaseStatus details={details} /> : <HealthStatus status={deployment.healthStatus} pending={pending} />
      }
      action={
        <div className={classes.headerAction}>
          {headline && <span>{headline}</span>}
          <IconButton
            size="small"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            aria-expanded={expanded}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </div>
      }
    >
      {expanded && (
        <>
          <div className={classes.stats}>
            <Stat
              icon={<CallSplitIcon className={classes.statIcon} />}
              value={
                deployment.version ? (
                  <VersionLink version={deployment.version} repository={versions.repository} />
                ) : (
                  '—'
                )
              }
              label="Version"
            />
            <Stat icon={<WidgetsIcon className={classes.statIcon} />} value={workloadValue} label={workloadLabel} />
            <Stat
              icon={<SyncIcon className={synced ? classes.statIconGood : classes.statIcon} />}
              value={pending ? 'Pending' : deployment.syncStatus}
              label={pending ? 'Argo CD · application not found' : `Argo CD · ${deployment.healthStatus}`}
            />
            <Stat
              icon={<ScheduleIcon className={classes.statIcon} />}
              value={timing?.value ?? timeAgo(deployment.lastDeployed) ?? '—'}
              label={timing ? [timing.label, timing.context].filter(Boolean).join(' · ') : 'Last synced'}
            />
          </div>
          <Divider />

          {details && progress && progress.phase !== 'Healthy' && progress.phase !== 'Unknown' && (
            <RolloutSection details={details} logsAllowed={logsAllowed} onViewLogs={onViewLogs} />
          )}

          <WhatChangedSection
            progress={progress ?? { targetVersion: deployment.version, previous: null }}
            versions={versions}
            previousKnown={!!progress && progress.phase !== 'Unknown'}
            rollbackHref={rollbackHref}
          />

          <div className={classes.footer}>
            <Box display="flex" style={{ gap: 8 }}>
              <Button size="small" color="primary" variant="outlined" disabled={pending} onClick={onViewDetails}>
                View details
              </Button>
              <Tooltip title={logsAllowed ? '' : 'Sign in with GitHub to view logs'}>
                {/* span: a disabled button emits no events, so Tooltip needs a wrapper */}
                <span>
                  <Button
                    size="small"
                    color="primary"
                    variant="outlined"
                    startIcon={<DescriptionIcon fontSize="small" />}
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
                variant="outlined"
                href={argoUrl}
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNewIcon fontSize="small" />}
              >
                Open in Argo CD
              </Button>
            )}
          </div>
        </>
      )}
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
        live={detailsEnvironment ? state.summaries[detailsEnvironment] : undefined}
        repository={versions.repository}
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
