import { useNavigate } from 'react-router-dom';
import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import {
  EmptyState,
  InfoCard,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { Deployment } from './joinDeployments';
import { useDeployments } from './useDeployments';
import {
  EnvironmentChip,
  HealthStatus,
  SyncStatus,
  VersionTag,
  timeAgo,
} from '../platformUi';

const useStyles = makeStyles(theme => ({
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(110px, 1fr) minmax(90px, 1fr) minmax(90px, 1fr) minmax(100px, 1fr) 24px',
    alignItems: 'center',
    gap: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.5, 1),
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(110px, 1fr) minmax(90px, 1fr) minmax(90px, 1fr) minmax(100px, 1fr) 24px',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 1, 0.5),
    color: theme.palette.text.secondary,
  },
  chevron: {
    color: theme.palette.text.secondary,
  },
}));

const DeploymentRow = ({ d, onClick }: { d: Deployment; onClick: () => void }) => {
  const classes = useStyles();
  const pending = !d.argoApplicationName;
  const deployed = timeAgo(d.lastDeployed);
  return (
    <ListItem button className={classes.row} onClick={onClick} divider>
      <Box>
        <EnvironmentChip environment={d.environment} />
      </Box>
      <Box>
        <VersionTag version={d.version} />
        {deployed && (
          <Typography variant="caption" color="textSecondary" component="div">
            deployed {deployed}
          </Typography>
        )}
      </Box>
      <Box>
        <SyncStatus status={d.syncStatus} pending={pending} />
      </Box>
      <Box>
        <HealthStatus status={d.healthStatus} pending={pending} />
      </Box>
      <ChevronRightIcon className={classes.chevron} fontSize="small" />
    </ListItem>
  );
};

// Level 1 of BACKSTAGE_PART7.md's hierarchy: "where is my service deployed
// and is it healthy?" — intentionally compact, one row per environment.
// Everything else lives on the Deployments tab (DeploymentsContent.tsx),
// which every row and the footer link open.
export const DeploymentsCard = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const navigate = useNavigate();
  const state = useDeployments(entity.metadata.name);
  const hasRows = state.status === 'done' && state.deployments.length > 0;

  return (
    <InfoCard
      title="Deployments"
      subheader="Where this service runs, and whether it's healthy"
      deepLink={hasRows ? { title: 'View deployments', link: 'deployments' } : undefined}
    >
      {state.status === 'loading' && <Progress />}
      {state.status === 'error' && <ResponseErrorPanel error={state.error} />}
      {state.status === 'done' && state.deployments.length === 0 && (
        <EmptyState
          missing="data"
          title="Not deployed anywhere yet"
          description="No Release CRs reference this component yet."
        />
      )}
      {hasRows && (
        <>
          <Box className={classes.header}>
            <Typography variant="overline">Environment</Typography>
            <Typography variant="overline">Version</Typography>
            <Typography variant="overline">Sync</Typography>
            <Typography variant="overline">Health</Typography>
            <span />
          </Box>
          <List disablePadding>
            {state.deployments.map(d => (
              <DeploymentRow key={d.environment} d={d} onClick={() => navigate('deployments')} />
            ))}
          </List>
        </>
      )}
    </InfoCard>
  );
};
