import { useEffect, useState, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import ErrorIcon from '@material-ui/icons/Error';
import WarningIcon from '@material-ui/icons/Warning';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import { alpha, makeStyles, useTheme, type Theme } from '@material-ui/core/styles';
import {
  Progress,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  StatusWarning,
  WarningPanel,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useDeployments } from '../deployments/useDeployments';
import { serviceOverviewUrl, useGrafanaUiUrl } from './grafana';
import { REFRESH_INTERVAL_MS, useObservabilitySummary } from './useObservabilitySummary';
import { Sparkline } from './Sparkline';
import { EnvironmentCard, PlatformEmptyState, timeAgo } from '../platformUi';
import { displayFont } from '../theme/themes';
import {
  formatCount,
  formatLatency,
  formatPercent,
  formatRate,
  formatReplicas,
  NO_DATA,
  type ObservabilitySummary,
  type SeriesKey,
} from './summary';
import {
  ERROR_RATE_DEGRADED_PERCENT,
  evaluateHealth,
  type HealthEvaluation,
  type MetricEvaluation,
  type MetricState,
} from './health';

const SERIES_RANGE_SECONDS = 30 * 60;

// Status colour per tile state; null = no emphasis (the calm default).
const stateColor = (theme: Theme, state: MetricState): string | null => {
  if (state === 'critical') return theme.palette.error.main;
  if (state === 'warning') return theme.palette.warning.main;
  return null;
};

const useStyles = makeStyles(theme => ({
  section: {
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: '0.68rem',
    fontWeight: 700,
    marginBottom: theme.spacing(1),
  },
  // Every tile has the same four rows (label, value, context line, visual)
  // at the same heights, so tiles line up across and down the grid.
  tile: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2, 2, 1.5),
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  stateIcon: { fontSize: '1.1rem' },
  value: {
    fontFamily: displayFont,
    fontSize: '1.6rem',
    fontWeight: 600,
    lineHeight: 1.25,
    marginTop: theme.spacing(0.25),
    whiteSpace: 'nowrap',
  },
  unit: {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(0.5),
  },
  context: {
    height: 22,
    marginTop: theme.spacing(0.5),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  reason: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' },
  visual: {
    marginTop: 'auto',
    paddingTop: theme.spacing(1),
    height: 36 + 8,
  },
  pips: { display: 'flex', alignItems: 'center', gap: 6, height: 36 },
  pip: { width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box' },
  meterTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 400ms ease',
  },
  healthTrigger: {
    background: 'none',
    border: 0,
    padding: 0,
    font: 'inherit',
    color: 'inherit',
    cursor: 'help',
    outline: 'none',
    borderRadius: theme.shape.borderRadius,
    '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
  },
  explanationBox: {
    maxWidth: 340,
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[4],
    fontSize: '0.8rem',
  },
  explanationArrow: {
    color: theme.palette.background.paper,
    '&::before': { border: `1px solid ${theme.palette.divider}` },
  },
  explanation: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    '& .MuiTypography-body2': { fontSize: '0.8rem' },
    '& ul': { margin: theme.spacing(0.5, 0, 0), paddingLeft: theme.spacing(2.5), fontWeight: 400 },
  },
  explanationLead: { fontWeight: 600 },
  live: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: theme.spacing(1),
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
}));

// Splits "12.4 req/s" / "42 ms" / "18%" / "1 / 2 ready" into a big value
// and a quieter unit.
const ValueText = ({ text }: { text: string }) => {
  const classes = useStyles();
  const match = /^([\d.,]+(?: \/ [\d.,]+)?)\s*(%|ms|s|req\/s|ready)$/.exec(text);
  if (!match || text === NO_DATA) return <>{text}</>;
  return (
    <>
      {match[1]}
      <span className={classes.unit}>{match[2]}</span>
    </>
  );
};

const StateIcon = ({ state }: { state: MetricState }) => {
  const classes = useStyles();
  const theme = useTheme();
  if (state === 'critical') {
    return <ErrorIcon className={classes.stateIcon} style={{ color: theme.palette.error.main }} titleAccess="Critical" />;
  }
  if (state === 'warning') {
    return <WarningIcon className={classes.stateIcon} style={{ color: theme.palette.warning.main }} titleAccess="Warning" />;
  }
  return null;
};

// One signal. Calm when normal; when warning/critical, the border, a light
// tint, the icon, the value and the reason line all take the status colour
// so the offending tile is the first thing the eye lands on.
const Tile = ({
  label,
  value,
  evaluation,
  context,
  visual,
}: {
  label: string;
  value: string;
  evaluation: MetricEvaluation;
  // One line under the value (a short explanation or a meter). Replaced by
  // the evaluation's reason when the tile is abnormal.
  context?: ReactNode;
  // The fixed-height bottom row: a sparkline or pips.
  visual?: ReactNode;
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const { state, reason } = evaluation;
  const color = stateColor(theme, state);
  const failed = reason === 'Could not be queried';

  return (
    <Box
      className={classes.tile}
      data-testid={`metric-${label}`}
      data-state={state}
      style={
        color
          ? {
              borderColor: alpha(color, 0.6),
              backgroundColor: alpha(color, theme.palette.type === 'dark' ? 0.12 : 0.05),
            }
          : undefined
      }
    >
      <div className={classes.labelRow}>
        <Typography className={classes.label}>{label}</Typography>
        <StateIcon state={state} />
      </div>
      <Tooltip title={reason ?? ''}>
        <Typography
          className={classes.value}
          style={color ? { color } : undefined}
          color={state === 'unknown' ? 'textSecondary' : 'textPrimary'}
        >
          {failed ? 'unavailable' : <ValueText text={value} />}
        </Typography>
      </Tooltip>
      <div className={classes.context}>
        {color ? (
          <span className={classes.reason} style={{ color }} title={reason}>
            {reason}
          </span>
        ) : (
          context
        )}
      </div>
      <div className={classes.visual}>{visual}</div>
    </Box>
  );
};

// Share of a limit. Informational: no platform-wide "too high" threshold
// exists yet, so the fill stays the neutral accent at any value.
const Meter = ({ percent, label }: { percent: number; label: string }) => {
  const classes = useStyles();
  const theme = useTheme();
  const color = theme.palette.primary.main;
  return (
    <div
      className={classes.meterTrack}
      style={{ backgroundColor: alpha(color, 0.18) }}
      role="meter"
      aria-label={`${label} of limit`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className={classes.meterFill} style={{ width: `${Math.min(100, percent)}%`, backgroundColor: color }} />
    </div>
  );
};

// One dot per desired replica, filled when available: the replica count at
// a glance, missing ones outlined in the tile's status colour.
const ReplicaPips = ({ replicas, state }: { replicas: ObservabilitySummary['replicas']; state: MetricState }) => {
  const classes = useStyles();
  const theme = useTheme();
  if (!replicas || replicas.desired === 0 || replicas.desired > 12) return null;
  const missing = stateColor(theme, state) ?? theme.palette.text.disabled;
  return (
    <div className={classes.pips} aria-hidden>
      {Array.from({ length: replicas.desired }, (_, i) => (
        <span
          key={i}
          className={classes.pip}
          style={
            i < replicas.available
              ? { backgroundColor: theme.palette.success.main }
              : { border: `2px solid ${missing}` }
          }
        />
      ))}
    </div>
  );
};

const HealthStatus = ({ health }: { health: HealthEvaluation }) => {
  switch (health.overall) {
    case 'healthy':
      return <StatusOK>Healthy</StatusOK>;
    case 'degraded':
      return <StatusError>Degraded</StatusError>;
    case 'scaled-to-zero':
      return <StatusWarning>Scaled to zero</StatusWarning>;
    default:
      return (
        <Box display="flex" alignItems="center" style={{ gap: 6 }}>
          <HelpOutlineIcon fontSize="small" color="disabled" />
          <Typography variant="body2" color="textSecondary" component="span">
            Unknown
          </Typography>
        </Box>
      );
  }
};

const LEAD: Record<HealthEvaluation['overall'], string> = {
  healthy: 'Healthy:',
  degraded: 'Degraded because:',
  'scaled-to-zero': 'Scaled to zero:',
  unknown: 'Unknown because:',
};

// Why the status is what it is right now, then the fixed rule.
const HealthExplanation = ({ health, rateWindow }: { health: HealthEvaluation; rateWindow: string }) => {
  const classes = useStyles();
  return (
    <div className={classes.explanation}>
      <Typography variant="body2" className={classes.explanationLead} component="div">
        {LEAD[health.overall]}
        <ul>
          {health.reasons.map(r => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Typography>
      <Typography variant="body2">
        <b>Degraded</b> when fewer replicas are available than desired, or 5xx responses reach{' '}
        {ERROR_RATE_DEGRADED_PERCENT}% of requests over {rateWindow}. Restarts are flagged but don't degrade the
        service on their own.
      </Typography>
      <Typography variant="body2">Trends cover the last 30 minutes.</Typography>
    </div>
  );
};

const HealthIndicator = ({ health, rateWindow }: { health: HealthEvaluation; rateWindow: string }) => {
  const classes = useStyles();
  return (
    <Tooltip
      title={<HealthExplanation health={health} rateWindow={rateWindow} />}
      placement="bottom-end"
      arrow
      interactive
      classes={{ tooltip: classes.explanationBox, arrow: classes.explanationArrow }}
    >
      {/* A button so keyboard users can focus it and get the tooltip too. */}
      <button type="button" className={classes.healthTrigger}>
        <HealthStatus health={health} />
      </button>
    </Tooltip>
  );
};

const Signals = ({ summary, health }: { summary: ObservabilitySummary; health: HealthEvaluation }) => {
  const classes = useStyles();
  const theme = useTheme();
  const { metrics } = health;
  const end = Math.floor(Date.parse(summary.generatedAt) / 1000);
  const trend = (key: SeriesKey, label: string, format: (v: number) => string, evaluation: MetricEvaluation) => (
    <Sparkline
      label={label}
      points={summary.series?.points?.[key] ?? []}
      stepSeconds={summary.series?.stepSeconds ?? 30}
      rangeSeconds={SERIES_RANGE_SECONDS}
      end={end}
      format={format}
      accent={stateColor(theme, evaluation.state) ?? undefined}
    />
  );
  const ofLimit = (percent: number | null, label: string) =>
    percent === null ? null : (
      <>
        <Meter percent={percent} label={label} />
        of limit
      </>
    );

  return (
    <>
      <Typography className={classes.section}>Traffic</Typography>
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} sm={4}>
          <Tile
            label="Request rate"
            value={formatRate(summary.requestRate)}
            evaluation={metrics.requestRate}
            context={`${summary.rateWindow} rate`}
            visual={trend('requestRate', 'Request rate', formatRate, metrics.requestRate)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Tile
            label="Error rate"
            value={formatPercent(summary.errorRatePercent)}
            evaluation={metrics.errorRate}
            context="5xx responses"
            visual={trend('errorRatePercent', 'Error rate', formatPercent, metrics.errorRate)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Tile
            label="P95 latency"
            value={formatLatency(summary.p95LatencySeconds)}
            evaluation={metrics.p95Latency}
            context={`${summary.rateWindow} window`}
            visual={trend('p95LatencySeconds', 'P95 latency', formatLatency, metrics.p95Latency)}
          />
        </Grid>
      </Grid>

      <Box mt={3}>
        <Typography className={classes.section}>Resources & workload</Typography>
      </Box>
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} sm={4}>
          <Tile
            label="CPU"
            value={formatPercent(summary.cpuUtilizationPercent)}
            evaluation={metrics.cpu}
            context={ofLimit(summary.cpuUtilizationPercent, 'CPU')}
            visual={trend('cpuUtilizationPercent', 'CPU', formatPercent, metrics.cpu)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Tile
            label="Memory"
            value={formatPercent(summary.memoryUtilizationPercent)}
            evaluation={metrics.memory}
            context={ofLimit(summary.memoryUtilizationPercent, 'Memory')}
            visual={trend('memoryUtilizationPercent', 'Memory', formatPercent, metrics.memory)}
          />
        </Grid>
        {/* Third column split in two, so restarts get their own state while
            the columns still line up with the Traffic row. */}
        <Grid item xs={12} sm={4}>
          <Box display="flex" height="100%" style={{ gap: 16 }}>
            <Box flex={1} minWidth={0}>
              <Tile
                label="Replicas"
                value={formatReplicas(summary.replicas)}
                evaluation={metrics.replicas}
                context="available / desired"
                visual={<ReplicaPips replicas={summary.replicas} state={metrics.replicas.state} />}
              />
            </Box>
            <Box flex={1} minWidth={0}>
              <Tile
                label="Restarts 1h"
                value={formatCount(summary.restarts1h)}
                evaluation={metrics.restarts}
                context="container restarts"
              />
            </Box>
          </Box>
        </Grid>
      </Grid>
    </>
  );
};

// "Live · updated 5s ago", ticking every second between polls.
const Freshness = ({ updatedAt, error }: { updatedAt: number | null; error: Error | null }) => {
  const classes = useStyles();
  const theme = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (updatedAt === null) return <span />;
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  const age = seconds < 60 ? `${seconds}s ago` : timeAgo(new Date(updatedAt).toISOString(), now);
  const stale = error !== null;
  return (
    <Typography variant="caption" color="textSecondary" style={{ display: 'flex', alignItems: 'center' }}>
      <span
        className={classes.live}
        style={{ backgroundColor: stale ? theme.palette.warning.main : theme.palette.success.main }}
        aria-hidden
      />
      {stale ? `Refresh failed · showing data from ${age}` : `Live · updated ${age}`}
      {` · refreshes every ${REFRESH_INTERVAL_MS / 1000}s`}
    </Typography>
  );
};

// One environment's card. Polls its own summary so a failure stays in this
// card, and keeps the last good values on screen between polls.
export const MetricsCard = ({
  component,
  environment,
  grafanaUiUrl,
}: {
  component: string;
  environment: string;
  grafanaUiUrl?: string;
}) => {
  const classes = useStyles();
  const { summary, error, updatedAt, loading } = useObservabilitySummary(component, environment);
  const grafanaUrl = serviceOverviewUrl(grafanaUiUrl, component, environment);
  const health = summary ? evaluateHealth(summary) : null;

  let body;
  if (summary && health) {
    body = <Signals summary={summary} health={health} />;
  } else if (loading) {
    body = <Progress />;
  } else {
    body = <WarningPanel severity="error" title="Metrics unavailable" message={error?.message} />;
  }

  return (
    <EnvironmentCard
      environment={environment}
      action={
        summary && health ? (
          <Box pt={2} pr={2}>
            <HealthIndicator health={health} rateWindow={summary.rateWindow} />
          </Box>
        ) : undefined
      }
    >
      {body}
      <div className={classes.footer}>
        <Freshness updatedAt={updatedAt} error={summary ? error : null} />
        {grafanaUrl && (
          <Button
            size="small"
            color="primary"
            href={grafanaUrl}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon fontSize="small" />}
          >
            Open in Grafana
          </Button>
        )}
      </div>
    </EnvironmentCard>
  );
};

// The Metrics tab (OBSERVABILLITY_PART4.md Part 3): one golden-signals card
// per environment the component is deployed to — the same environment list
// as the Deployments tab (useDeployments), not a second definition. Overall
// health and per-tile states come from evaluateHealth (health.ts).
export const MetricsContent = () => {
  const { entity } = useEntity();
  const grafanaUiUrl = useGrafanaUiUrl();
  const component = entity.metadata.name;
  const deployments = useDeployments(component);

  if (deployments.status === 'loading') {
    return <Progress />;
  }
  if (deployments.status === 'error') {
    return <ResponseErrorPanel error={deployments.error} />;
  }
  if (deployments.deployments.length === 0) {
    return (
      <PlatformEmptyState
        icon={<ShowChartIcon />}
        title="No metrics yet"
        description="Metrics appear here per environment once the component is deployed."
      />
    );
  }

  return (
    <Grid container spacing={3}>
      {deployments.deployments.map(({ environment }) => (
        <Grid item xs={12} key={environment}>
          <MetricsCard component={component} environment={environment} grafanaUiUrl={grafanaUiUrl} />
        </Grid>
      ))}
    </Grid>
  );
};
