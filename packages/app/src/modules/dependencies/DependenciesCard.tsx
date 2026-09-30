import { Fragment } from 'react';
import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { EnvironmentChip } from '../platformUi';
import { useDependencies } from './useDependencies';

const useStyles = makeStyles(theme => ({
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(110px, auto) 1fr',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 1),
  },
  names: {
    minWidth: 0,
  },
}));

// Overview summary, like the Deployments card: one row per environment that
// has dependencies, naming them. Status and details live on the
// Dependencies tab (the card's footer link).
export const DependenciesCard = () => {
  const classes = useStyles();
  const state = useDependencies();

  if (state.status === 'loading') {
    return (
      <InfoCard title="Dependencies">
        <Progress />
      </InfoCard>
    );
  }
  if (state.status === 'error') {
    return (
      <InfoCard title="Dependencies">
        <ResponseErrorPanel error={state.error} />
      </InfoCard>
    );
  }
  const used = state.environments.filter(e => e.count > 0);
  if (used.length === 0) {
    return null;
  }

  return (
    <InfoCard
      title="Dependencies"
      subheader="Infrastructure this service uses, per environment"
      deepLink={{ title: 'View dependencies', link: 'dependencies' }}
    >
      <List disablePadding>
        {used.map(({ environment, groups }) => (
          <ListItem key={environment ?? 'all'} divider className={classes.row}>
            <Box>
              {environment ? (
                <EnvironmentChip environment={environment} />
              ) : (
                <Typography variant="body2">All environments</Typography>
              )}
            </Box>
            <Typography variant="body2" className={classes.names} component="div">
              {groups.map((group, gi) => (
                <Fragment key={group.type}>
                  {gi > 0 && ' · '}
                  <Typography variant="caption" color="textSecondary">
                    {group.label}:{' '}
                  </Typography>
                  {group.entities.map((dependency, i) => (
                    <Fragment key={dependency.metadata.name}>
                      {i > 0 && ', '}
                      <EntityRefLink entityRef={dependency} hideIcon />
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </Typography>
          </ListItem>
        ))}
      </List>
    </InfoCard>
  );
};
