import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { alpha, makeStyles, useTheme, type Theme } from '@material-ui/core/styles';
import { Link } from '@backstage/core-components';
import { useObservabilitySummary } from './useObservabilitySummary';
import { evaluateHealth, type OverallHealth } from './health';
import { formatLatency, formatPercent, formatRate } from './summary';
import { Sparkline } from './Sparkline';

// Compact, live views of one environment's health, for places that link to
// the Metrics tab rather than replace it (the Home page's service cards and
// the service header). Same backend route, polling and rules as the tab.

const LABEL: Record<OverallHealth, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  'scaled-to-zero': 'Scaled to zero',
  unknown: 'Unknown',
};

export const healthColor = (theme: Theme, overall: OverallHealth | null): string => {
  switch (overall) {
    case 'healthy':
      return theme.palette.success.main;
    case 'degraded':
      return theme.palette.error.main;
    case 'scaled-to-zero':
      return theme.palette.warning.main;
    default:
      return theme.palette.text.disabled;
  }
};

const useStyles = makeStyles(theme => ({
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1.25),
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    textDecoration: 'none !important',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(96px, 1.1fr) repeat(3, minmax(64px, 1fr)) minmax(80px, 1.4fr)',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 0),
    '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
  },
  env: { display: 'flex', alignItems: 'center', gap: theme.spacing(1), fontWeight: 600, fontSize: '0.85rem' },
  statLabel: { fontSize: '0.68rem', color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap' },
}));

// "● management · Healthy" — one per environment in the service header.
// On a coloured band (`onBrand`) it becomes a translucent white pill.
export const EnvironmentHealthPill = ({
  component,
  environment,
  href,
  onBrand,
}: {
  component: string;
  environment: string;
  href: string;
  onBrand?: boolean;
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const { summary } = useObservabilitySummary(component, environment);
  const health = summary ? evaluateHealth(summary) : null;
  const overall = health?.overall ?? null;
  const color = healthColor(theme, overall);
  const title = health ? health.reasons.join('; ') : 'Loading…';
  return (
    <Tooltip title={title}>
      <Link
        to={href}
        aria-label={`${environment}: ${overall ? LABEL[overall] : 'loading'}`}
        className={classes.pill}
        style={
          onBrand
            ? { backgroundColor: 'rgba(255,255,255,0.16)', color: '#fff', border: '1px solid rgba(255,255,255,0.28)' }
            : { backgroundColor: alpha(color, 0.1), color: theme.palette.text.primary }
        }
      >
        <span
          className={classes.dot}
          style={{ backgroundColor: color, boxShadow: onBrand ? '0 0 0 2px rgba(255,255,255,0.85)' : undefined }}
        />
        {environment}
        <span style={{ opacity: 0.8, fontWeight: 500 }}>· {overall ? LABEL[overall] : '…'}</span>
      </Link>
    </Tooltip>
  );
};

// One environment as a row: status, the three traffic signals and a
// request-rate trend. Abnormal signals take the status colour.
export const EnvironmentPulseRow = ({ component, environment }: { component: string; environment: string }) => {
  const classes = useStyles();
  const theme = useTheme();
  const { summary } = useObservabilitySummary(component, environment);
  const health = summary ? evaluateHealth(summary) : null;
  const color = healthColor(theme, health?.overall ?? null);
  const errorColor = health?.metrics.errorRate.state === 'critical' ? theme.palette.error.main : undefined;

  const stat = (label: string, value: string, valueColor?: string) => (
    <Box>
      <Typography className={classes.statLabel}>{label}</Typography>
      <Typography className={classes.statValue} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <div className={classes.row}>
      <Tooltip title={health ? health.reasons.join('; ') : 'Loading…'}>
        <div className={classes.env}>
          <span className={classes.dot} style={{ backgroundColor: color }} />
          {environment}
        </div>
      </Tooltip>
      {stat('Requests', summary ? formatRate(summary.requestRate) : '…')}
      {stat('Errors', summary ? formatPercent(summary.errorRatePercent) : '…', errorColor)}
      {stat('P95', summary ? formatLatency(summary.p95LatencySeconds) : '…')}
      {summary ? (
        <Sparkline
          label={`${environment} request rate`}
          points={summary.series?.points?.requestRate ?? []}
          stepSeconds={summary.series?.stepSeconds ?? 30}
          rangeSeconds={30 * 60}
          end={Math.floor(Date.parse(summary.generatedAt) / 1000)}
          format={formatRate}
          accent={health?.overall === 'degraded' ? theme.palette.error.main : undefined}
        />
      ) : (
        <span />
      )}
    </div>
  );
};
