import { makeStyles } from '@material-ui/core/styles';
import {
  StatusAborted,
  StatusError,
  StatusOK,
  StatusPending,
  StatusRunning,
  StatusWarning,
} from '@backstage/core-components';
import type { EnvironmentDetails } from './useEnvironmentDetails';
import { phaseLabel } from './progressView';

const useStyles = makeStyles({
  // Backstage's StatusRunning icon is static; spin it so an in-flight
  // rollout doesn't look frozen between polls.
  '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
  spinning: {
    '& svg': { animation: '$spin 1.2s linear infinite' },
    '@media (prefers-reduced-motion: reduce)': { '& svg': { animation: 'none' } },
  },
});

// The rollout phase (backend DeploymentProgress) as a status indicator, on
// the environment card and in its Details drawer. Unknown is grey, never
// red: an unreachable cluster isn't a failed deploy.
export const PhaseStatus = ({ details }: { details: EnvironmentDetails }) => {
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
