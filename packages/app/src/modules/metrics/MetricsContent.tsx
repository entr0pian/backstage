import { useEffect, useState, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { alpha, makeStyles, useTheme } from '@material-ui/core/styles';
import {
  EmptyState,
  InfoCard,
  Progress,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  StatusPending,
  StatusWarning,
  WarningPanel,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useDeployments } from '../deployments/useDeployments';
import { serviceOverviewUrl, useGrafanaUiUrl } from './grafana';
import { REFRESH_INTERVAL_MS, useObservabilitySummary } from './useObservabilitySummary';
import { Sparkline } from './Sparkline';
import { timeAgo } from '../platformUi';
import {
  ERROR_RATE_DEGRADED_PERCENT,
  formatCount,
  formatLatency,
  formatPercent,
  formatRate,
  formatReplicas,
  healthReason,
  metricsHealth,
  NO_DATA,
  UTILIZATION_CRITICAL_PERCENT,
  UTILIZATION_WARNING_PERCENT,
  utilizationSeverity,
  type ObservabilitySummary,
  type SeriesKey,
  type Severity,
} from './summary';

const SERIES_RANGE_SECONDS = 30 * 60;

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
  label: {
    color: theme.palette.text.secondary,
    fontSize: '0.78rem',
    fontWeight: 500,
  },
  value: {
    fontSize: '1.6rem',
    fontWeight: 600,
    lineHeight: 1.25,
    marginTop: theme.spacing(0.25),
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
  visual: {
    marginTop: 'auto',
    paddingTop: theme.spacing(1),
    height: 36 + 8,
  },
  inlineStat: {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  inlineValue: {
    fontSize: '1.1rem',
    fontWeight: 600,
  },
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
  live: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginRight: theme.spacing(1),
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
  },
  explanationLead: { fontWeight: 600 },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
}));

// Splits "12.4 req/s" / "42 ms" / "18%" into a big number and a quieter unit.
const ValueText = ({ text }: { text: string }) => {
  const classes = useStyles();
  const match = /^([\d.,]+)\s*(%|ms|s|req\/s)$/.exec(text);
  if (!match || text === NO_DATA) return <>{text}</>;
  return (
    <>
      {match[1]}
      <span className={classes.unit}>{match[2]}</span>
    </>
  );
};

const Tile = ({
  label,
  value,
  unavailable,
  blankHint,
  context,
  visual,
}: {
  label: string;
  value: string;
  unavailable?: boolean;
  // Why the value is blank (no data), shown on hover.
  blankHint?: string;
  // One line under the value: a short explanation, a meter, or a status
  // (severity icon + words, never colour alone).
  context?: ReactNode;
  // The fixed-height bottom row: a sparkline or an inline stat.
  visual?: ReactNode;
}) => {
  const classes = useStyles();
  let title = '';
  if (unavailable) title = 'This metric could not be queried';
  else if (value === NO_DATA) title = blankHint ?? 'No data';
  return (
    <Box className={classes.tile}>
      <Typography className={classes.label}>{label}</Typography>
      <Tooltip title={title}>
        <Typography className={classes.value} color={unavailable ? 'textSecondary' : 'textPrimary'}>
          {unavailable ? 'unavailable' : <ValueText text={value} />}
        </Typography>
      </Tooltip>
      <div className={classes.context}>{context}</div>
      <div className={classes.visual}>{visual}</div>
    </Box>
  );
};

// Share of a limit: the fill carries severity, the track is a lighter step
// of the same colour.
const Meter = ({ percent, label }: { percent: number | null; label: string }) => {
  const classes = useStyles();
  const theme = useTheme();
  if (percent === null) return null;
  const severity = utilizationSeverity(percent);
  const color = {
    normal: theme.palette.primary.main,
    warning: theme.palette.warning.main,
    critical: theme.palette.error.main,
  }[severity];
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

const SeverityNote = ({ severity, children }: { severity: Severity; children: ReactNode }) => {
  if (severity === 'critical') return <StatusError>{children}</StatusError>;
  if (severity === 'warning') return <StatusWarning>{children}</StatusWarning>;
  return <>{children}</>;
};

const HealthStatus = ({ summary }: { summary: ObservabilitySummary }) => {
  switch (metricsHealth(summary)) {
    case 'healthy':
      return <StatusOK>Healthy</StatusOK>;
    case 'degraded':
      return <StatusError>Degraded</StatusError>;
    case 'scaled-to-zero':
      return <StatusWarning>Scaled to zero</StatusWarning>;
    default:
      return <StatusPending>No data</StatusPending>;
  }
};

// The rule behind the status, shown on hover/focus: why it's in this state
// right now, then the fixed thresholds. Keeps the card free of footnotes.
const HealthExplanation = ({ summary }: { summary: ObservabilitySummary }) => {
  const classes = useStyles();
  return (
    <div className={classes.explanation}>
      <Typography variant="body2" className={classes.explanationLead}>
        {healthReason(summary)}
      </Typography>
      <Typography variant="body2">
        <b>Degraded</b> when fewer replicas are available than desired, or 5xx responses reach{' '}
        {ERROR_RATE_DEGRADED_PERCENT}% of requests over {summary.rateWindow}.
      </Typography>
      <Typography variant="body2">
        CPU and memory are a share of the containers' limits: amber at {UTILIZATION_WARNING_PERCENT}%, red at{' '}
        {UTILIZATION_CRITICAL_PERCENT}%.
      </Typography>
      <Typography variant="body2">Trends cover the last 30 minutes.</Typography>
    </div>
  );
};

const HealthIndicator = ({ summary }: { summary: ObservabilitySummary }) => {
  const classes = useStyles();
  return (
    <Tooltip
      title={<HealthExplanation summary={summary} />}
      placement="bottom-end"
      arrow
      interactive
      classes={{ tooltip: classes.explanationBox, arrow: classes.explanationArrow }}
    >
      {/* A button so keyboard users can focus it and get the tooltip too. */}
      <button type="button" className={classes.healthTrigger}>
        <HealthStatus summary={summary} />
      </button>
    </Tooltip>
  );
};

const Signals = ({ summary }: { summary: ObservabilitySummary }) => {
  const classes = useStyles();
  const off = (key: string) => summary.unavailable.includes(key);
  const end = Math.floor(Date.parse(summary.generatedAt) / 1000);
  const trend = (key: SeriesKey, label: string, format: (v: number) => string) => (
    <Sparkline
      label={label}
      points={summary.series?.points?.[key] ?? []}
      stepSeconds={summary.series?.stepSeconds ?? 30}
      rangeSeconds={SERIES_RANGE_SECONDS}
      end={end}
      format={format}
    />
  );
  const noTraffic = `No traffic in the last ${summary.rateWindow}`;

  const errorSeverity: Severity =
    summary.errorRatePercent !== null && summary.errorRatePercent >= ERROR_RATE_DEGRADED_PERCENT
      ? 'critical'
      : 'normal';
  const cpuSeverity = utilizationSeverity(summary.cpuUtilizationPercent);
  const memorySeverity = utilizationSeverity(summary.memoryUtilizationPercent);
  // Meter plus words; the words switch to a status once past a threshold.
  const utilizationContext = (percent: number | null, severity: Severity, label: string) =>
    percent === null ? null : (
      <>
        <Meter percent={percent} label={label} />
        <SeverityNote severity={severity}>
          {severity === 'normal' ? 'of limit' : `≥ ${severity === 'critical' ? UTILIZATION_CRITICAL_PERCENT : UTILIZATION_WARNING_PERCENT}% of limit`}
        </SeverityNote>
      </>
    );

  const replicas = summary.replicas;
  const replicaShort = replicas !== null && replicas.available < replicas.desired;
  const restarts = summary.restarts1h;

  return (
    <>
      <Typography className={classes.section}>Traffic</Typography>
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} sm={4}>
          <Tile
            label="Request rate"
            value={formatRate(summary.requestRate)}
            unavailable={off('requestRate')}
            blankHint="Not scraped by Prometheus"
            context={`${summary.rateWindow} rate`}
            visual={trend('requestRate', 'Request rate', formatRate)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Tile
            label="Error rate"
            value={formatPercent(summary.errorRatePercent)}
            unavailable={off('errorRatePercent')}
            blankHint={noTraffic}
            context={
              <SeverityNote severity={errorSeverity}>
                {errorSeverity === 'critical' ? `≥ ${ERROR_RATE_DEGRADED_PERCENT}% 5xx responses` : '5xx responses'}
              </SeverityNote>
            }
            visual={trend('errorRatePercent', 'Error rate', formatPercent)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Tile
            label="P95 latency"
            value={formatLatency(summary.p95LatencySeconds)}
            unavailable={off('p95LatencySeconds')}
            blankHint={noTraffic}
            context={`${summary.rateWindow} window`}
            visual={trend('p95LatencySeconds', 'P95 latency', formatLatency)}
          />
        </Grid>
      </Grid>

      <Box mt={3}>
        <Typography className={classes.section}>Resources</Typography>
      </Box>
      <Grid container spacing={2} alignItems="stretch">
        <Grid item xs={12} sm={4}>
          <Tile
            label="CPU"
            value={formatPercent(summary.cpuUtilizationPercent)}
            unavailable={off('cpuUtilizationPercent')}
            blankHint="No CPU limit set"
            context={utilizationContext(summary.cpuUtilizationPercent, cpuSeverity, 'CPU')}
            visual={trend('cpuUtilizationPercent', 'CPU', formatPercent)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Tile
            label="Memory"
            value={formatPercent(summary.memoryUtilizationPercent)}
            unavailable={off('memoryUtilizationPercent')}
            blankHint="No memory limit set"
            context={utilizationContext(summary.memoryUtilizationPercent, memorySeverity, 'Memory')}
            visual={trend('memoryUtilizationPercent', 'Memory', formatPercent)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <Tile
            label="Replicas"
            value={formatReplicas(replicas)}
            unavailable={off('replicasAvailable') || off('replicasDesired')}
            blankHint="No Deployment found in this environment"
            context={
              replicaShort ? <StatusError>Fewer available than desired</StatusError> : 'available / desired'
            }
            visual={
              <div className={classes.inlineStat}>
                <Typography className={classes.label}>Restarts in the last hour</Typography>
                <Box display="flex" alignItems="center">
                  {restarts !== null && restarts > 0 && <StatusWarning />}
                  <Typography className={classes.inlineValue} color={off('restarts1h') ? 'textSecondary' : 'textPrimary'}>
                    {off('restarts1h') ? 'unavailable' : formatCount(restarts)}
                  </Typography>
                </Box>
              </div>
            }
          />
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

  let body;
  if (summary) {
    body = <Signals summary={summary} />;
  } else if (loading) {
    body = <Progress />;
  } else {
    body = <WarningPanel severity="error" title="Metrics unavailable" message={error?.message} />;
  }

  return (
    <InfoCard
      title={environment}
      action={
        summary ? (
          <Box pt={2} pr={2}>
            <HealthIndicator summary={summary} />
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
    </InfoCard>
  );
};

// The Metrics tab (OBSERVABILLITY_PART4.md Part 3): one golden-signals card
// per environment the component is deployed to — the same environment list
// as the Deployments tab (useDeployments), not a second definition. Health:
// Degraded when available < desired replicas or the error rate is at or
// above ERROR_RATE_DEGRADED_PERCENT; see metricsHealth.
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
      <EmptyState
        missing="data"
        title="No deployments found for this component"
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
