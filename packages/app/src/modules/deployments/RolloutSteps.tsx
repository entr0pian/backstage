import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles } from '@material-ui/core/styles';
import type { EnvironmentDetails } from './useEnvironmentDetails';

type Step = EnvironmentDetails['rolloutSteps'][number];

const useStyles = makeStyles(theme => ({
  list: { listStyle: 'none', margin: 0, padding: 0 },
  step: {
    display: 'grid',
    gridTemplateColumns: '72px 10px 1fr',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.25, 0),
    fontSize: '0.8rem',
  },
  time: { fontFamily: 'monospace', color: theme.palette.text.secondary },
  dot: { width: 6, height: 6, borderRadius: '50%', justifySelf: 'center' },
  object: { color: theme.palette.text.secondary },
}));

function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// The current rollout's steps (backend RolloutEvents.ts), oldest first, the
// last `limit` of them. Owners get the raw Kubernetes message on hover.
export const RolloutSteps = ({ steps, limit }: { steps: Step[]; limit?: number }) => {
  const classes = useStyles();
  const shown = limit ? steps.slice(-limit) : steps;
  return (
    <ul className={classes.list}>
      {shown.map(step => (
        <Tooltip key={`${step.at}/${step.objectName}/${step.reason}`} title={step.message ?? ''} placement="top-start">
          <li className={classes.step}>
            <span className={classes.time}>{clock(step.at)}</span>
            <span
              className={classes.dot}
              style={{ backgroundColor: step.type === 'Warning' ? '#f59e0b' : '#94a3b8' }}
            />
            <span>
              {step.summary}
              {step.count > 1 && ` ×${step.count}`}
              {step.objectKind === 'Pod' && <span className={classes.object}> · {step.objectName}</span>}
            </span>
          </li>
        </Tooltip>
      ))}
    </ul>
  );
};
