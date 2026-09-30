import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import StorageIcon from '@material-ui/icons/Storage';
import CategoryIcon from '@material-ui/icons/Category';
import { StatusError, StatusOK, StatusPending } from '@backstage/core-components';
import type { Entity } from '@backstage/catalog-model';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import { useDatabaseDetails } from '../databases/useDatabaseDetails';
import type { DependencyGroup } from './groupByType';

const useStyles = makeStyles(theme => ({
  groupLabel: {
    color: theme.palette.text.secondary,
    display: 'block',
    marginTop: theme.spacing(1),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.25, 1),
  },
  icon: {
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.75),
    boxSizing: 'content-box',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 600,
  },
}));

// Live status line for a platform Database, from the same guest-safe route
// the Database page uses (BACKSTAGE_PART9.md Part B).
const DatabaseStatus = ({ namespace, name }: { namespace: string; name: string }) => {
  const state = useDatabaseDetails(namespace, name);
  if (state.status === 'loading') {
    return (
      <Typography variant="caption" color="textSecondary">
        checking…
      </Typography>
    );
  }
  if (state.status === 'error') {
    return <StatusPending>Status unavailable</StatusPending>;
  }
  const d = state.details;
  const facts = [
    d.engine && [d.engine.engine, d.engine.version].filter(Boolean).join(' '),
    d.spec.size,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Box display="flex" alignItems="center" style={{ gap: 12 }}>
      {d.ready === true && <StatusOK>Ready</StatusOK>}
      {d.ready === false && <StatusError>Not ready</StatusError>}
      {d.ready === null && <StatusPending>Unknown</StatusPending>}
      {facts && (
        <Typography variant="caption" color="textSecondary">
          {facts}
        </Typography>
      )}
    </Box>
  );
};

const DependencyRow = ({ dependency }: { dependency: Entity }) => {
  const classes = useStyles();
  const annotations = dependency.metadata.annotations ?? {};
  const k8sNamespace = annotations['platform.taskapp.io/kubernetes-namespace'];
  const dbName = annotations['platform.taskapp.io/database-name'];
  const isPlatformDatabase = dependency.spec?.type === 'database' && k8sNamespace && dbName;
  const Icon = dependency.spec?.type === 'database' ? StorageIcon : CategoryIcon;

  return (
    <ListItem className={classes.row} divider>
      <Icon className={classes.icon} fontSize="small" />
      <Box className={classes.main}>
        <Typography variant="body1" className={classes.name} component="div">
          <EntityRefLink entityRef={dependency} hideIcon />
        </Typography>
        {isPlatformDatabase ? (
          <DatabaseStatus namespace={k8sNamespace} name={dbName} />
        ) : (
          dependency.metadata.description && (
            <Typography variant="caption" color="textSecondary">
              {dependency.metadata.description}
            </Typography>
          )
        )}
      </Box>
    </ListItem>
  );
};

// One environment's dependencies, grouped by type — each row links to its
// own page and, for platform Databases, shows live status.
export const DependencyList = ({ groups }: { groups: DependencyGroup[] }) => {
  const classes = useStyles();
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
              />
            ))}
          </List>
        </Box>
      ))}
    </>
  );
};
