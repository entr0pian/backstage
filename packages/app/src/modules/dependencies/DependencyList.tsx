import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import StorageIcon from '@material-ui/icons/Storage';
import CategoryIcon from '@material-ui/icons/Category';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import type { Entity } from '@backstage/catalog-model';
import { Link as RouterLink } from 'react-router-dom';
import { displayFont } from '../theme/themes';
import type { DependencyGroup } from './groupByType';
import { DatabaseHealth } from './DatabaseHealth';
import { ENVIRONMENT_ANNOTATION } from './groupByEnvironment';
import { dependencyTitle, useDependencyHref } from './useDependencyHref';

// A platform Database the portal can show live status for: one the
// platform provisioned, so it knows its namespace, name and environment.
export const platformDatabase = (dependency: Entity) => {
  const annotations = dependency.metadata.annotations ?? {};
  const namespace = annotations['platform.taskapp.io/kubernetes-namespace'];
  const name = annotations['platform.taskapp.io/database-name'];
  const environment = annotations[ENVIRONMENT_ANNOTATION];
  return dependency.spec?.type === 'database' && namespace && name && environment
    ? { namespace, name, environment }
    : null;
};

const useStyles = makeStyles(theme => ({
  groupLabel: {
    color: theme.palette.text.secondary,
    display: 'block',
    marginTop: theme.spacing(1),
  },
  item: {
    padding: 0,
  },
  // The whole row is the link to the dependency's page.
  row: {
    width: '100%',
    color: 'inherit',
    textDecoration: 'none !important',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.25, 1.5),
    borderRadius: 12,
    transition: 'background-color 150ms ease, transform 200ms cubic-bezier(.34,1.56,.64,1)',
    // Same affordance as the Deployments rows: the row slides, the chevron
    // follows.
    '&:hover $chevron': { transform: 'translateX(3px)', color: theme.palette.primary.main },
    '&:hover': {
      transform: 'translateX(4px)',
      backgroundColor: theme.palette.type === 'dark' ? 'rgba(129,140,248,0.08)' : 'rgba(99,102,241,0.05)',
    },
  },
  icon: {
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.type === 'dark' ? 'rgba(129,140,248,0.14)' : 'rgba(99,102,241,0.1)',
    borderRadius: 10,
    padding: theme.spacing(1),
    boxSizing: 'content-box',
    transition: 'transform 250ms cubic-bezier(.34,1.56,.64,1)',
  },
  chevron: {
    color: theme.palette.text.secondary,
    transition: 'transform 200ms ease, color 200ms ease',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: displayFont,
    fontWeight: 700,
  },
}));

const DependencyRow = ({ dependency, onlyDatabase }: { dependency: Entity; onlyDatabase: boolean }) => {
  const classes = useStyles();
  const database = platformDatabase(dependency);
  const Icon = dependency.spec?.type === 'database' ? StorageIcon : CategoryIcon;
  const href = useDependencyHref();

  return (
    <ListItem className={classes.item}>
      <RouterLink to={href(dependency)} className={classes.row}>
        <Icon className={classes.icon} fontSize="small" />
        <Box className={classes.main}>
          <Typography variant="body1" color="primary" className={classes.name} component="div">
            {dependencyTitle(dependency)}
          </Typography>
          {database ? (
            <DatabaseHealth {...database} onlyDatabase={onlyDatabase} />
          ) : (
            dependency.metadata.description && (
              <Typography variant="caption" color="textSecondary">
                {dependency.metadata.description}
              </Typography>
            )
          )}
        </Box>
        <ChevronRightIcon className={classes.chevron} fontSize="small" />
      </RouterLink>
    </ListItem>
  );
};

// One environment's dependencies, grouped by type — each row links to its
// own page and, for platform Databases, shows whether it's available, has
// the latest schema, and is bound.
export const DependencyList = ({ groups }: { groups: DependencyGroup[] }) => {
  const classes = useStyles();
  const databaseCount = groups.flatMap(g => g.entities).filter(platformDatabase).length;
  return (
    <>
      {groups.map(group => (
        <Box key={group.type}>
          <Typography variant="overline" className={classes.groupLabel}>
            {group.label}
          </Typography>
          <List disablePadding>
            {group.entities.map(dependency => (
              <DependencyRow
                key={`${dependency.kind}:${dependency.metadata.namespace}/${dependency.metadata.name}`}
                dependency={dependency}
                onlyDatabase={databaseCount === 1}
              />
            ))}
          </List>
        </Box>
      ))}
    </>
  );
};
