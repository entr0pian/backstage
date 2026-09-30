import type { ReactNode } from 'react';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { brand } from '../theme/themes';

const useStyles = makeStyles(theme => ({
  root: {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(6, 3),
    borderRadius: 20,
    border: `1.5px dashed ${theme.palette.type === 'dark' ? 'rgba(129,140,248,0.35)' : 'rgba(99,102,241,0.3)'}`,
    background:
      theme.palette.type === 'dark'
        ? 'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.18), transparent 60%)'
        : 'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.10), transparent 60%)',
  },
  bubble: {
    width: 72,
    height: 72,
    borderRadius: 24,
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    marginBottom: theme.spacing(1),
    backgroundImage: `linear-gradient(135deg, ${brand.indigo}, ${brand.cyanDeep})`,
    boxShadow: `0 12px 28px -10px ${brand.indigo}`,
    animation: '$float 3.2s ease-in-out infinite',
    '& svg': { fontSize: 34 },
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  },
  '@keyframes float': {
    '0%, 100%': { transform: 'translateY(0) rotate(-4deg)' },
    '50%': { transform: 'translateY(-6px) rotate(4deg)' },
  },
  title: {
    fontFamily: theme.typography.h1.fontFamily,
    fontWeight: 800,
    fontSize: '1.35rem',
    letterSpacing: '-0.02em',
  },
  text: { color: theme.palette.text.secondary, maxWidth: 440 },
  action: { marginTop: theme.spacing(2) },
}));

// The platform's empty state: a floating icon, a friendly line and, when
// the viewer can act, the one thing to do next.
export const PlatformEmptyState = ({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) => {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <div className={classes.bubble} aria-hidden>
        {icon}
      </div>
      <Typography component="h2" className={classes.title}>
        {title}
      </Typography>
      <Typography variant="body2" className={classes.text}>
        {description}
      </Typography>
      {action && <div className={classes.action}>{action}</div>}
    </div>
  );
};
