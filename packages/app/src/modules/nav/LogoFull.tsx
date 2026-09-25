import { makeStyles } from '@material-ui/core';
import { LogoMark } from './LogoMark';

// The sidebar is dark in both light and dark mode, so the wordmark is
// always light text.
const useStyles = makeStyles({
  svg: {
    width: 'auto',
    height: 32,
  },
  name: {
    fill: '#ffffff',
    fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  tagline: {
    fill: '#9ca3af',
    fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.14em',
  },
});

export const LogoFull = () => {
  const classes = useStyles();

  return (
    <svg
      className={classes.svg}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 150 32"
      role="img"
      aria-label="gerodimos.dev platform"
    >
      <LogoMark gradientId="logo-full-gradient" />
      <text x="42" y="14" className={classes.name}>
        gerodimos.dev
      </text>
      <text x="42" y="28" className={classes.tagline}>
        PLATFORM
      </text>
    </svg>
  );
};
