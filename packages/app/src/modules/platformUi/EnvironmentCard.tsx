import type { ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { InfoCard } from '@backstage/core-components';
import { accentGradient, environmentAccent, type EnvironmentAccent } from './environmentAccent';

// What the card's environment is going through, for its accent bar and glow:
// a deployment in flight, one that needs attention, one that failed, or one
// that has just finished (a single green glow). Unset: at rest.
export type EnvironmentActivity = 'active' | 'attention' | 'failed' | 'completed';

const AMBER = { from: '#f59e0b', to: '#f97316' };
const RED = { from: '#ef4444', to: '#dc2626' };
const GREEN = '#22c55e';

interface StyleProps {
  accent: EnvironmentAccent;
  activity?: EnvironmentActivity;
}

function barAccent({ accent, activity }: StyleProps): EnvironmentAccent {
  if (activity === 'attention') return AMBER;
  if (activity === 'failed') return RED;
  return accent;
}

// color-mix keeps one variable (--glow) for every state's colour.
const glow = (pct: number) => `color-mix(in srgb, var(--glow) ${pct}%, transparent)`;

const useStyles = makeStyles(theme => ({
  // A thin bar in the environment's colour along the top edge. Nothing moves
  // on hover (these cards aren't links); it moves only while a deployment is
  // underway, so motion always means "something is happening".
  card: {
    position: 'relative',
    '--bar': (p: StyleProps) => accentGradient(barAccent(p), 90),
    '--glow': (p: StyleProps) => {
      if (p.activity === 'completed') return GREEN;
      return barAccent(p).from;
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '0 0 auto 0',
      height: 4,
      background: 'var(--bar)',
      opacity: 0.85,
    },
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none !important',
      '&::before': { animation: 'none !important' },
    },
  },
  // A light sheen sweeping along the bar, and a faint breathing outline.
  '@keyframes sheen': {
    from: { backgroundPosition: '-40% 0, 0 0' },
    to: { backgroundPosition: '140% 0, 0 0' },
  },
  '@keyframes breathe': {
    '0%, 100%': { boxShadow: `0 0 0 1px ${glow(18)}` },
    '50%': { boxShadow: `0 0 0 1px ${glow(45)}, 0 0 26px -8px ${glow(60)}` },
  },
  '@keyframes finished': {
    '0%': { boxShadow: `0 0 0 2px ${glow(70)}, 0 0 30px -6px ${glow(70)}` },
    '100%': { boxShadow: `0 0 0 1px ${glow(0)}, 0 0 0 0 ${glow(0)}` },
  },
  moving: {
    '&::before': {
      height: 5,
      opacity: 1,
      background: 'none',
      backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent), var(--bar)',
      backgroundSize: '35% 100%, 100% 100%',
      backgroundRepeat: 'no-repeat',
    },
  },
  active: {
    animation: '$breathe 3s ease-in-out infinite',
    '&::before': { animation: '$sheen 2s linear infinite' },
  },
  // Slower than "active", so a stuck rollout reads differently at a glance.
  attention: {
    animation: '$breathe 4.5s ease-in-out infinite',
    '&::before': { animation: '$sheen 3.5s linear infinite' },
  },
  // A failure is shown, not flashed: a still red bar and frame.
  failed: {
    boxShadow: `0 0 0 1px ${glow(55)}`,
    '&::before': { opacity: 1, height: 5 },
  },
  completed: { animation: '$finished 1.6s ease-out 1' },
  title: { display: 'flex', alignItems: 'center', gap: theme.spacing(1.5) },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: '1rem',
    textTransform: 'uppercase',
    background: ({ accent }: { accent: EnvironmentAccent }) => accentGradient(accent),
    boxShadow: ({ accent }: { accent: EnvironmentAccent }) => `0 6px 16px -6px ${accent.from}`,
  },
  name: {
    fontFamily: theme.typography.h1.fontFamily,
    fontWeight: 800,
    fontSize: '1.3rem',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
}));

// The card every per-environment tab uses: the environment's badge and name
// as the title (optionally followed by a status), and its colour along the top.
export const EnvironmentCard = ({
  environment,
  activity,
  status,
  subheader,
  action,
  deepLink,
  children,
}: {
  environment: string;
  activity?: EnvironmentActivity;
  status?: ReactNode;
  subheader?: ReactNode;
  action?: ReactNode;
  deepLink?: { title: string; link: string };
  children?: ReactNode;
}) => {
  const classes = useStyles({ accent: environmentAccent(environment), activity });
  const activityClass = activity
    ? [
        (activity === 'active' || activity === 'attention') && classes.moving,
        classes[activity],
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  return (
    <InfoCard
      className={`${classes.card} ${activityClass}`.trim()}
      title={
        <Box className={classes.title}>
          <span className={classes.badge} aria-hidden>
            {environment.charAt(0)}
          </span>
          <Typography component="span" className={classes.name}>
            {environment}
          </Typography>
          {status && <Box ml={1.5}>{status}</Box>}
        </Box>
      }
      subheader={subheader}
      action={action}
      deepLink={deepLink}
    >
      {children}
    </InfoCard>
  );
};
