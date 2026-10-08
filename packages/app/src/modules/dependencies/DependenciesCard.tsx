import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { EnvironmentChip } from '../platformUi';
import { useDependencies } from './useDependencies';
import { DatabaseHealth } from './DatabaseHealth';
import { platformDatabase } from './DependencyList';

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
    display: 'grid',
    gap: theme.spacing(0.75),
  },
  group: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    alignItems: 'baseline',
    columnGap: theme.spacing(1),
  },
  dependency: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.5),
    gridColumn: 2,
  },
}));

// Overview summary, like the Deployments card: one row per environment that
// has dependencies, naming them; each platform Database also says, in one
// line, whether it's available, has the latest schema, and is bound.
// Details live on the Dependencies tab (the card's footer link).
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
            <Box className={classes.names}>
              {groups.map(group => {
                const databaseCount = group.entities.filter(platformDatabase).length;
                return (
                  <Box key={group.type} className={classes.group}>
                    <Typography variant="caption" color="textSecondary">
                      {group.label}:
                    </Typography>
                    {group.entities.map(dependency => {
                      const database = platformDatabase(dependency);
                      return (
                        <Box key={dependency.metadata.name} className={classes.dependency}>
                          <Typography variant="body2" component="span">
                            <EntityRefLink entityRef={dependency} hideIcon />
                          </Typography>
                          {database && <DatabaseHealth {...database} onlyDatabase={databaseCount === 1} compact />}
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>
          </ListItem>
        ))}
      </List>
    </InfoCard>
  );
};
