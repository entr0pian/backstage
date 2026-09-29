import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { makeStyles } from '@material-ui/core/styles';
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
import { useObservabilitySummary } from './useObservabilitySummary';
import {
  ERROR_RATE_DEGRADED_PERCENT,
  formatCount,
  formatLatency,
  formatPercent,
  formatRate,
  formatReplicas,
  NO_DATA,
  metricsHealth,
  type ObservabilitySummary,
} from './summary';

const useStyles = makeStyles(theme => ({
  label: {
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontSize: '0.7rem',
    fontWeight: 600,
  },
  value: {
    fontSize: '1.4rem',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
}));

const Stat = ({
  label,
  value,
  unavailable,
  hint,
}: {
  label: string;
  value: string;
  unavailable?: boolean;
  // Why the value is blank (no data), shown on hover.
  hint?: string;
}) => {
  const classes = useStyles();
  const shown = unavailable ? 'unavailable' : value;
  let title = '';
  if (unavailable) title = 'This metric could not be queried';
  else if (value === NO_DATA) title = hint ?? 'No data';
  return (
    <Box>
      <Typography className={classes.label}>{label}</Typography>
      <Tooltip title={title}>
        <Typography className={classes.value} color={unavailable ? 'textSecondary' : 'textPrimary'}>
          {shown}
        </Typography>
      </Tooltip>
    </Box>
  );
};

const HealthIndicator = ({ summary }: { summary: ObservabilitySummary }) => {
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

const Signals = ({ summary }: { summary: ObservabilitySummary }) => {
  const off = (key: string) => summary.unavailable.includes(key);
  const noTraffic = 'No traffic in the last 5 minutes';
  return (
    <Grid container spacing={2}>
      <Grid item xs={6} sm={4}>
        <Stat label="Request rate" value={formatRate(summary.requestRate)} unavailable={off('requestRate')} hint="Not scraped by Prometheus" />
      </Grid>
      <Grid item xs={6} sm={4}>
        <Stat label="Error rate" value={formatPercent(summary.errorRatePercent)} unavailable={off('errorRatePercent')} hint={noTraffic} />
      </Grid>
      <Grid item xs={6} sm={4}>
        <Stat label="P95 latency" value={formatLatency(summary.p95LatencySeconds)} unavailable={off('p95LatencySeconds')} hint={noTraffic} />
      </Grid>
      <Grid item xs={6} sm={3}>
        <Stat label="CPU" value={formatPercent(summary.cpuUtilizationPercent)} unavailable={off('cpuUtilizationPercent')} hint="No CPU limit set" />
      </Grid>
      <Grid item xs={6} sm={3}>
        <Stat label="Memory" value={formatPercent(summary.memoryUtilizationPercent)} unavailable={off('memoryUtilizationPercent')} hint="No memory limit set" />
      </Grid>
      <Grid item xs={6} sm={3}>
        <Stat
          label="Replicas"
          value={formatReplicas(summary.replicas)}
          unavailable={off('replicasAvailable') || off('replicasDesired')}
          hint="No Deployment found in this environment"
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <Stat label="Restarts 1h" value={formatCount(summary.restarts1h)} unavailable={off('restarts1h')} />
      </Grid>
    </Grid>
  );
};

// One environment's card. Fetches its own summary so a failure stays in
// this card.
export const MetricsCard = ({
  component,
  environment,
  grafanaUiUrl,
}: {
  component: string;
  environment: string;
  grafanaUiUrl?: string;
}) => {
  const state = useObservabilitySummary(component, environment);
  const grafanaUrl = serviceOverviewUrl(grafanaUiUrl, component, environment);

  let body;
  if (state.status === 'loading') {
    body = <Progress />;
  } else if (state.status === 'error') {
    body = <WarningPanel severity="error" title="Metrics unavailable" message={state.error.message} />;
  } else {
    body = <Signals summary={state.summary} />;
  }

  return (
    <InfoCard
      title={environment}
      action={
        state.status === 'done' ? (
          <Box pt={2} pr={2}>
            <HealthIndicator summary={state.summary} />
          </Box>
        ) : undefined
      }
    >
      {body}
      {grafanaUrl && (
        <Box display="flex" justifyContent="flex-end" mt={2}>
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
        </Box>
      )}
    </InfoCard>
  );
};

// The Metrics tab (OBSERVABILLITY_PART4.md Part 3): one golden-signals card
// per environment the component is deployed to — the same environment list
// as the Deployments tab (useDeployments), not a second definition. Health:
// Degraded when available < desired replicas or the 5m error rate is at or
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
        <Grid item xs={12} md={6} key={environment}>
          <MetricsCard component={component} environment={environment} grafanaUiUrl={grafanaUiUrl} />
        </Grid>
      ))}
      <Grid item xs={12}>
        <Typography variant="caption" color="textSecondary">
          5-minute rates; CPU and memory are a share of the containers' limits. Degraded: fewer available replicas than desired, or error rate at or above{' '}
          {ERROR_RATE_DEGRADED_PERCENT}%.
        </Typography>
      </Grid>
    </Grid>
  );
};
