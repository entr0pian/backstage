// Small presentational pieces shared by the platform's own cards
// (Deployments, Dependencies, Details drawer, Database page) so they read as
// one design. Theme-aware: colours come from the active Backstage theme.
import Chip from '@material-ui/core/Chip';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import {
  StatusError,
  StatusOK,
  StatusPending,
  StatusWarning,
} from '@backstage/core-components';

const useStyles = makeStyles(theme => ({
  envChip: {
    fontWeight: 600,
    letterSpacing: 0.3,
    height: 22,
  },
  version: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
  },
}));

// 40-hex git SHAs are shown as their short form; tags ("v1.2.3", "latest")
// are shown as-is.
export const shortVersion = (v: string) => (/^[0-9a-f]{40}$/.test(v) ? v.slice(0, 7) : v);

export const EnvironmentChip = ({ environment }: { environment: string }) => {
  const classes = useStyles();
  return (
    <Chip
      className={classes.envChip}
      label={environment}
      size="small"
      variant="outlined"
      color={environment === 'prod' || environment === 'production' ? 'secondary' : 'primary'}
    />
  );
};

export const VersionTag = ({ version }: { version: string | null }) => {
  const classes = useStyles();
  if (!version) {
    return (
      <Typography variant="body2" color="textSecondary" component="span">
        —
      </Typography>
    );
  }
  const short = shortVersion(version);
  const tag = <span className={classes.version}>{short}</span>;
  return short === version ? tag : <Tooltip title={version}>{tag}</Tooltip>;
};

export function timeAgo(value: string | null, now: number = Date.now()): string | null {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Argo CD sync/health as coloured status indicators. `pending`: the Release
// exists but Argo CD has no Application for it yet.
export const SyncStatus = ({ status, pending }: { status: string; pending?: boolean }) => {
  if (pending) return <StatusPending>Pending</StatusPending>;
  if (status === 'Synced') return <StatusOK>Synced</StatusOK>;
  if (status === 'OutOfSync') return <StatusWarning>Out of sync</StatusWarning>;
  return <StatusPending>{status}</StatusPending>;
};

export const HealthStatus = ({ status, pending }: { status: string; pending?: boolean }) => {
  if (pending) return <StatusPending>Pending</StatusPending>;
  switch (status) {
    case 'Healthy':
      return <StatusOK>Healthy</StatusOK>;
    case 'Degraded':
    case 'Missing':
      return <StatusError>{status}</StatusError>;
    case 'Progressing':
      return <StatusPending>Progressing</StatusPending>;
    default:
      return <StatusWarning>{status}</StatusWarning>;
  }
};
