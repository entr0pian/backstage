import { makeStyles } from '@material-ui/core';
import { LogoMark } from './LogoMark';

const useStyles = makeStyles({
  svg: {
    width: 'auto',
    height: 28,
  },
});

export const LogoIcon = () => {
  const classes = useStyles();

  return (
    <svg
      className={classes.svg}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      role="img"
      aria-label="gerodimos.dev platform"
    >
      <LogoMark gradientId="logo-icon-gradient" />
    </svg>
  );
};
