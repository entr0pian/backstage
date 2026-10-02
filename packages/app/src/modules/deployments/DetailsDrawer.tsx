import { useState, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import AccountTreeIcon from '@material-ui/icons/AccountTreeOutlined';
import CallSplitIcon from '@material-ui/icons/CallSplit';
import CheckCircleIcon from '@material-ui/icons/CheckCircleOutline';
import CloseIcon from '@material-ui/icons/Close';
import DescriptionIcon from '@material-ui/icons/DescriptionOutlined';
import ExtensionIcon from '@material-ui/icons/ExtensionOutlined';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import RefreshIcon from '@material-ui/icons/Refresh';
import ScheduleIcon from '@material-ui/icons/Schedule';
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet';
import SyncIcon from '@material-ui/icons/Sync';
import TimelineIcon from '@material-ui/icons/Timeline';
import WarningIcon from '@material-ui/icons/ReportProblemOutlined';
import WidgetsIcon from '@material-ui/icons/WidgetsOutlined';
import {
  Link,
  Progress,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  StatusWarning,
} from '@backstage/core-components';
import { useRouteRef } from '@backstage/core-plugin-api';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import { type Deployment } from './joinDeployments';
import { argoApplicationUrl } from '../platformUi/argocd';
import { useEnvironmentDetails, type EnvironmentDetails } from './useEnvironmentDetails';
import { PhaseStatus } from './PhaseStatus';
import { problemLabel } from './progressView';
import { shortVersion, timeAgo } from '../platformUi';
import { commitUrl } from './whatChanged';

function age(since: string | null): string {
  if (!since) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function time(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const useStyles = makeStyles(theme => ({
  panel: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
  },
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  panelTitle: { fontWeight: 700, fontSize: '0.95rem', flex: 1 },
  panelIcon: { color: theme.palette.text.secondary },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: theme.spacing(2),
  },
  stat: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing(1.5) },
  statIcon: { color: theme.palette.text.secondary, marginTop: 2 },
  statIconGood: { color: theme.palette.success.main, marginTop: 2 },
  statIconBad: { color: theme.palette.warning.main, marginTop: 2 },
  statValue: { fontWeight: 700, fontSize: '0.95rem' },
  statLabel: { color: theme.palette.text.secondary, fontSize: '0.8rem' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
    '& th': {
      textAlign: 'left',
      color: theme.palette.text.secondary,
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      padding: theme.spacing(0.75, 1),
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
    '& td': {
      padding: theme.spacing(1, 1),
      borderBottom: `1px solid ${theme.palette.divider}`,
      verticalAlign: 'middle',
    },
    '& tr:last-child td': { borderBottom: 0 },
  },
  name: {
    fontFamily: 'monospace',
    maxWidth: 170,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 8 },
  muted: { color: theme.palette.text.secondary },
  line: { marginBottom: theme.spacing(0.75), fontSize: '0.875rem' },
  footer: { display: 'flex', gap: theme.spacing(1), marginTop: theme.spacing(3), flexWrap: 'wrap' },
}));

const Panel = ({
  icon,
  title,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) => {
  const classes = useStyles();
  return (
    <div className={classes.panel}>
      <div className={classes.panelHead}>
        {icon}
        <Typography className={classes.panelTitle}>{title}</Typography>
        {aside}
      </div>
      {children}
    </div>
  );
};

const VersionValue = ({ version, url }: { version: string; url: string | null }) => {
  const label = <span style={{ fontFamily: 'monospace' }}>{shortVersion(version)}</span>;
  return url ? <Link to={url}>{label}</Link> : label;
};

const Stat = ({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: ReactNode }) => {
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

type Tone = 'good' | 'warn' | 'bad' | 'idle';

type PodSummary = EnvironmentDetails['workload']['pods'][number];

function podStatus(pod: PodSummary): { tone: Tone; text: string } {
  if (pod.ready) return { tone: 'good', text: pod.phase };
  if (pod.problem) return { tone: 'bad', text: problemLabel(pod.problem.kind, pod.problem.reason) };
  return { tone: 'warn', text: `${pod.phase}, not ready` };
}

const Dot = ({ tone }: { tone: Tone }) => {
  const classes = useStyles();
  const colors: Record<Tone, string> = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', idle: '#94a3b8' };
  return <span className={classes.dot} style={{ backgroundColor: colors[tone] }} />;
};

// The Database page for a binding's provider. Entity names are
// "<namespace>-<crName>" — the Platform Entity Provider's
// databaseEntityName() in the backend; keep the two in step.
const useDatabaseLink = () => {
  const entityRoute = useRouteRef(entityRouteRef);
  return (ref: { namespace: string; name: string }) =>
    entityRoute({ namespace: 'default', kind: 'resource', name: `${ref.namespace}-${ref.name}` });
};

const SummaryPanel = ({
  details,
  deployment,
  repository,
}: {
  details: EnvironmentDetails;
  deployment: Deployment;
  repository: string | null;
}) => {
  const classes = useStyles();
  const { progress, workload, release } = details;
  const deployedAt = progress.completedAt;
  const ready = progress.target?.ready ?? progress.previous?.ready ?? 0;
  const matches = workload.imageMatchesRelease;
  let matchIcon = <CheckCircleIcon className={classes.statIcon} />;
  let matchValue = 'Nothing running';
  if (matches === true) {
    matchIcon = <CheckCircleIcon className={classes.statIconGood} />;
    matchValue = 'Release matches';
  } else if (matches === false) {
    matchIcon = <WarningIcon className={classes.statIconBad} />;
    matchValue = 'Release differs';
  }
  return (
    <Panel icon={<AccountTreeIcon className={classes.panelIcon} />} title="Deployment summary">
      <div className={classes.summary}>
        <Stat
          icon={<CallSplitIcon className={classes.statIcon} />}
          value={
            release ? (
              <VersionValue version={release.version} url={commitUrl(repository, release.version)} />
            ) : (
              '—'
            )
          }
          label="Version"
        />
        <Stat
          icon={<ScheduleIcon className={classes.statIcon} />}
          value={deployedAt ? `Deployed ${timeAgo(deployedAt)}` : '—'}
          label={deployedAt ? time(deployedAt) : 'Not rolled out yet'}
        />
        <Stat
          icon={<WidgetsIcon className={ready === progress.desiredReplicas && ready > 0 ? classes.statIconGood : classes.statIcon} />}
          value={`${ready} / ${progress.desiredReplicas} ready`}
          label="Workload"
        />
        <Stat
          icon={<SyncIcon className={deployment.syncStatus === 'Synced' ? classes.statIconGood : classes.statIcon} />}
          value={deployment.syncStatus}
          label={`Argo CD · ${deployment.healthStatus}`}
        />
        <Stat
          icon={matchIcon}
          value={matchValue}
          label={workload.runningImageTags.length ? `Image: ${workload.runningImageTags.map(shortVersion).join(', ')}` : 'No pods'}
        />
      </div>
    </Panel>
  );
};

const ResourcesPanel = ({
  details,
  argoUrl,
  logsAllowed,
  onViewLogs,
}: {
  details: EnvironmentDetails;
  argoUrl: string | null;
  logsAllowed: boolean;
  onViewLogs: (podName?: string) => void;
}) => {
  const classes = useStyles();
  const { workload, networking, progress } = details;
  const dep = workload.deployment;
  const depReady = progress.target?.ready ?? 0;
  return (
    <Panel
      icon={<WidgetsIcon className={classes.panelIcon} />}
      title="Kubernetes resources"
      aside={argoUrl && <Link to={argoUrl}>View in Argo CD</Link>}
    >
      {!details.cluster.reachable ? (
        <Typography className={classes.muted}>The workload cluster can't be reached right now.</Typography>
      ) : (
        <table className={classes.table}>
          <thead>
            <tr>
              <th>Resource</th>
              <th>Name</th>
              <th>Status</th>
              <th>Details</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {dep && (
              <tr>
                <td>Deployment</td>
                <td className={classes.name}>{dep.name}</td>
                <td>
                  <Dot tone={depReady === dep.replicas ? 'good' : 'warn'} />
                  {depReady} / {dep.replicas} ready
                </td>
                <td className={classes.muted}>{plural(dep.replicas, 'replica')}</td>
                <td className={classes.muted}>{age(dep.createdAt)}</td>
              </tr>
            )}
            {workload.pods.map(pod => {
              const status = podStatus(pod);
              return (
              <tr key={`${pod.namespace}/${pod.name}`}>
                <td>Pod</td>
                <td className={classes.name} title={pod.name}>
                  {logsAllowed ? (
                    <Link to="#" onClick={e => { e.preventDefault(); onViewLogs(pod.name); }}>
                      {pod.name}
                    </Link>
                  ) : (
                    pod.name
                  )}
                </td>
                <td>
                  <Dot tone={status.tone} />
                  {status.text}
                </td>
                <td className={classes.muted}>{plural(pod.restarts, 'restart')}</td>
                <td className={classes.muted}>{age(pod.createdAt)}</td>
              </tr>
              );
            })}
            {networking.services.map(svc => (
              <tr key={`${svc.namespace}/${svc.name}`}>
                <td>Service</td>
                <td className={classes.name}>{svc.name}</td>
                <td>
                  <Dot tone={svc.readyEndpoints > 0 ? 'good' : 'bad'} />
                  {plural(svc.readyEndpoints, 'endpoint')}
                </td>
                <td className={classes.muted}>{svc.ports.map(p => `:${p.port}`).join(', ')}</td>
                <td className={classes.muted}>{age(svc.createdAt)}</td>
              </tr>
            ))}
            {!dep && workload.pods.length === 0 && networking.services.length === 0 && (
              <tr>
                <td colSpan={5} className={classes.muted}>
                  Nothing found for this environment. Resources are found by their platform.taskapp.io labels.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </Panel>
  );
};

const NetworkingPanel = ({ details }: { details: EnvironmentDetails }) => {
  const classes = useStyles();
  return (
    <Panel icon={<SettingsEthernetIcon className={classes.panelIcon} />} title="Networking">
      {details.networking.services.length === 0 && (
        <Typography className={classes.line}>
          <span className={classes.muted}>No Service found for this environment.</span>
        </Typography>
      )}
      {details.networking.services.map(svc => (
        <Typography key={`${svc.namespace}/${svc.name}`} className={classes.line} component="div">
          Service <b>{svc.name}</b> {svc.ports.map(p => `:${p.port}`).join(', ')} →{' '}
          {plural(svc.readyEndpoints, 'ready endpoint')}
          {svc.notReadyEndpoints > 0 ? `, ${svc.notReadyEndpoints} not ready` : ''}
        </Typography>
      ))}
      <Typography className={classes.line}>
        <span className={classes.muted}>No external URL yet — ingress isn't configured for this environment.</span>
      </Typography>
    </Panel>
  );
};

const BindingsPanel = ({ details }: { details: EnvironmentDetails }) => {
  const classes = useStyles();
  const databaseLink = useDatabaseLink();
  return (
    <Panel icon={<ExtensionIcon className={classes.panelIcon} />} title="Configuration & dependencies">
      {details.bindings.length === 0 && (
        <Typography className={classes.line}>
          <span className={classes.muted}>The Release declares no bindings.</span>
        </Typography>
      )}
      {details.bindings.map(b => (
        <Box key={b.name} mb={1.5}>
          <Typography className={classes.line} component="div">
            {b.problem ? <StatusError>{b.name}</StatusError> : <StatusOK>{b.name}</StatusOK>}
          </Typography>
          <Box ml={4} className={classes.muted} fontSize="0.8rem">
            {b.providerRef && (
              <div>
                provided by {b.providerRef.kind}{' '}
                {b.providerRef.kind === 'Database' ? (
                  <Link to={databaseLink(b.providerRef)}>{b.providerRef.name}</Link>
                ) : (
                  b.providerRef.name
                )}
              </div>
            )}
            {b.externalSecret && (
              <div>
                secret {b.externalSecret.name} · {b.externalSecret.reason ?? 'no status yet'}
                {b.externalSecret.refreshTime ? ` · refreshed ${time(b.externalSecret.refreshTime)}` : ''}
              </div>
            )}
            {b.externalSecret?.remoteKey && (
              <div>
                from Secrets Manager <code>{b.externalSecret.remoteKey}</code>
              </div>
            )}
            <div>
              mounted at <code>{b.mountPath}</code>
            </div>
            {b.problem && <StatusError>{b.problem}</StatusError>}
            {b.externalSecret?.message && b.externalSecret.ready !== true && <div>{b.externalSecret.message}</div>}
          </Box>
        </Box>
      ))}
    </Panel>
  );
};

const WarningList = ({ details, limit }: { details: EnvironmentDetails; limit?: number }) => {
  const classes = useStyles();
  const shown = limit ? details.warnings.slice(0, limit) : details.warnings;
  return (
    <>
      {shown.map(w => (
        <Box key={`${w.reason}/${w.objectKind}/${w.objectName}`} mb={1}>
          <Typography className={classes.line} component="div">
            <StatusWarning>
              {w.reason} ×{w.count}
            </StatusWarning>{' '}
            <span className={classes.muted}>
              on {w.objectKind} {w.objectName} · last {time(w.lastSeen)}
            </span>
          </Typography>
          {w.message && (
            <Box ml={4} className={classes.muted} fontSize="0.8rem">
              {w.message}
            </Box>
          )}
        </Box>
      ))}
      {details.detailLevel === 'summary' && details.warnings.length > 0 && (
        <Typography className={classes.line}>
          <span className={classes.muted}>Sign in with GitHub to see full event messages.</span>
        </Typography>
      )}
    </>
  );
};

const EventsPanel = ({ details, onShowAll }: { details: EnvironmentDetails; onShowAll: () => void }) => {
  const classes = useStyles();
  const count = details.warnings.length;
  return (
    <Panel
      icon={<TimelineIcon className={classes.panelIcon} />}
      title="Recent events (last hour)"
      aside={count === 0 ? <StatusOK>No warnings</StatusOK> : <StatusWarning>{plural(count, 'warning')}</StatusWarning>}
    >
      {count === 0 ? (
        <Typography className={classes.line}>
          <span className={classes.muted}>No warnings in the last hour.</span>
        </Typography>
      ) : (
        <>
          <WarningList details={details} limit={3} />
          {count > 3 && (
            <Button size="small" color="primary" onClick={onShowAll}>
              See all {count} in Events
            </Button>
          )}
        </>
      )}
    </Panel>
  );
};

// Level 3 of the Deployments tab (BACKSTAGE_PART9.md Part A): one
// component in one environment. Details groups it by what it means to a
// developer (is it running, what's it made of, can anything reach it, is it
// wired correctly); Events is everything that went wrong in the last hour.
export const DetailsDrawer = ({
  component,
  deployment,
  live,
  repository = null,
  argocdUiUrl,
  logsAllowed,
  onClose,
  onViewLogs,
}: {
  component: string;
  deployment: Deployment | null;
  // The card's own (polled) summary: shown at once while the drawer loads its own.
  live?: EnvironmentDetails;
  // The component's GitHub repository, for linking the version to its commit.
  repository?: string | null;
  argocdUiUrl?: string;
  logsAllowed: boolean;
  onClose: () => void;
  onViewLogs: (environment: string, podName?: string) => void;
}) => {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const state = useEnvironmentDetails(component, deployment?.environment ?? null);
  const details = state.status === 'done' ? state.details : live;
  const argoUrl = deployment
    ? argoApplicationUrl(argocdUiUrl, {
        name: deployment.argoApplicationName,
        namespace: deployment.argoApplicationNamespace,
      })
    : null;
  const viewLogs = (podName?: string) => deployment && onViewLogs(deployment.environment, podName);

  return (
    <Drawer anchor="right" open={deployment !== null} onClose={onClose}>
      <Box width={720} maxWidth="100vw" p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5">
              {component} · {deployment?.environment}
            </Typography>
            {details?.release && (
              <Typography variant="body2" color="textSecondary">
                Release {details.release.name} → {shortVersion(details.release.version)}
                {details.progress.completedAt ? ` · deployed ${time(details.progress.completedAt)}` : ''}
              </Typography>
            )}
          </Box>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            {details && <PhaseStatus details={details} />}
            <IconButton aria-label="Close details" onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} indicatorColor="primary" textColor="primary">
          <Tab label="Details" />
          <Tab label={details?.warnings.length ? `Events (${details.warnings.length})` : 'Events'} />
        </Tabs>

        {!details && state.status === 'loading' && <Progress />}
        {!details && state.status === 'error' && <ResponseErrorPanel error={state.error} />}
        {details && deployment && tab === 0 && (
          <>
            <SummaryPanel details={details} deployment={deployment} repository={repository} />
            <ResourcesPanel details={details} argoUrl={argoUrl} logsAllowed={logsAllowed} onViewLogs={viewLogs} />
            <NetworkingPanel details={details} />
            <BindingsPanel details={details} />
            <EventsPanel details={details} onShowAll={() => setTab(1)} />
          </>
        )}
        {details && tab === 1 && (
          <Panel icon={<TimelineIcon className={classes.panelIcon} />} title="Warnings (last hour)">
            {details.warnings.length === 0 ? (
              <StatusOK>No warnings in the last hour.</StatusOK>
            ) : (
              <WarningList details={details} />
            )}
          </Panel>
        )}

        <div className={classes.footer}>
          {argoUrl && (
            <Button
              variant="contained"
              color="primary"
              href={argoUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon fontSize="small" />}
            >
              Open in Argo CD
            </Button>
          )}
          {deployment && logsAllowed && (
            <Button variant="outlined" color="primary" startIcon={<DescriptionIcon />} onClick={() => viewLogs()}>
              Logs
            </Button>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={state.reload}>
            Refresh
          </Button>
        </div>
      </Box>
    </Drawer>
  );
};
