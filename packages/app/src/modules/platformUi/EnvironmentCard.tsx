import type { ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { InfoCard } from '@backstage/core-components';
import { accentGradient, environmentAccent, type EnvironmentAccent } from './environmentAccent';

const useStyles = makeStyles(theme => ({
  // A thin bar in the environment's colour along the top edge, brightening
  // on hover (the lift itself comes from the theme's MuiCard hover).
  card: {
    position: 'relative',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '0 0 auto 0',
      height: 4,
      background: ({ accent }: { accent: EnvironmentAccent }) => accentGradient(accent, 90),
      opacity: 0.85,
      transition: 'opacity 200ms ease, height 200ms ease',
    },
    '&:hover::before': { opacity: 1, height: 5 },
  },
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
    transition: 'transform 250ms cubic-bezier(.34,1.56,.64,1)',
    '$card:hover &': { transform: 'rotate(-8deg) scale(1.06)' },
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
// as the title, and its colour along the top.
export const EnvironmentCard = ({
  environment,
  subheader,
  action,
  deepLink,
  children,
}: {
  environment: string;
  subheader?: ReactNode;
  action?: ReactNode;
  deepLink?: { title: string; link: string };
  children?: ReactNode;
}) => {
  const classes = useStyles({ accent: environmentAccent(environment) });
  return (
    <InfoCard
      className={classes.card}
      title={
        <Box className={classes.title}>
          <span className={classes.badge} aria-hidden>
            {environment.charAt(0)}
          </span>
          <Typography component="span" className={classes.name}>
            {environment}
          </Typography>
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
