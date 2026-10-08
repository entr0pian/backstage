import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { InfoCard, Progress, ResponseErrorPanel, StatusPending } from '@backstage/core-components';
import type { Entity } from '@backstage/catalog-model';
import { EnvironmentChip } from '../platformUi';
import { useDependencies } from './useDependencies';
import { HealthFactStatus, useDatabaseHealth } from './DatabaseHealth';
import { platformDatabase } from './DependencyList';
import { dependencyTitle, useDependencyHref } from './useDependencyHref';

// Same grid, row and hover as the Deployments card (DeploymentsCard.tsx),
// so the two Overview tables read alike.
const COLUMNS = 'minmax(110px, 1fr) minmax(120px, 1.4fr) minmax(90px, 1fr) minmax(90px, 1fr) minmax(90px, 1fr) 24px';

const useStyles = makeStyles(theme => ({
  row: {
    display: 'grid',
    gridTemplateColumns: COLUMNS,
    alignItems: 'center',
    gap: theme.spacing(2),
    borderRadius: 12,
    padding: theme.spacing(1.5, 1.5),
    transition: 'background-color 150ms ease, transform 200ms cubic-bezier(.34,1.56,.64,1)',
    '&:hover': { transform: 'translateX(4px)' },
    '&:hover $chevron': { transform: 'translateX(3px)', color: theme.palette.primary.main },
  },
  header: {
    display: 'grid',
    gridTemplateColumns: COLUMNS,
    gap: theme.spacing(2),
    padding: theme.spacing(0, 1, 0.5),
    color: theme.palette.text.secondary,
  },
  chevron: {
    color: theme.palette.text.secondary,
    transition: 'transform 200ms ease, color 200ms ease',
  },
  name: {
    minWidth: 0,
  },
}));

interface RowProps {
  environment: string | null;
  dependency: Entity;
  onlyDatabase: boolean;
}

// One row: the environment, the dependency's name (plus a caption, like the
// version's "deployed …" on the Deployments card), three status cells and
// the chevron. The whole row opens the dependency's page.
const RowShell = ({
  environment,
  dependency,
  caption,
  children,
}: Omit<RowProps, 'onlyDatabase'> & { caption?: string; children: ReactNode }) => {
  const classes = useStyles();
  const navigate = useNavigate();
  const href = useDependencyHref();
  return (
    <ListItem button className={classes.row} onClick={() => navigate(href(dependency))} divider>
      <Box>
        {environment ? (
          <EnvironmentChip environment={environment} />
        ) : (
          <Typography variant="body2">All</Typography>
        )}
      </Box>
      <Box className={classes.name}>
        <Typography variant="body2" color="primary" noWrap>
          {dependencyTitle(dependency)}
        </Typography>
        {caption && (
          <Typography variant="caption" color="textSecondary" component="div" noWrap>
            {caption}
          </Typography>
        )}
      </Box>
      {children}
      <ChevronRightIcon className={classes.chevron} fontSize="small" />
    </ListItem>
  );
};

const PlatformDatabaseRow = ({
  database,
  ...props
}: RowProps & { database: { namespace: string; name: string; environment: string } }) => {
  const health = useDatabaseHealth(database.namespace, database.name, database.environment, props.onlyDatabase);
  if (health.status !== 'done') {
    const placeholder =
      health.status === 'loading' ? (
        <Typography variant="caption" color="textSecondary">
          checking…
        </Typography>
      ) : (
        <StatusPending>Unavailable</StatusPending>
      );
    return (
      <RowShell {...props}>
        <Box>{placeholder}</Box>
        <Box />
        <Box />
      </RowShell>
    );
  }
  return (
    <RowShell {...props} caption={health.engine || undefined}>
      <Box>
        <HealthFactStatus fact={health.availability} compact />
      </Box>
      <Box>{health.schema && <HealthFactStatus fact={health.schema} compact />}</Box>
      <Box>
        <HealthFactStatus fact={health.binding} compact />
      </Box>
    </RowShell>
  );
};

// A dependency the platform didn't provision (declared in catalog-info.yaml):
// no live status, just its description.
const OtherDependencyRow = (props: RowProps) => (
  <RowShell {...props} caption={props.dependency.metadata.description}>
    <Box />
    <Box />
    <Box />
  </RowShell>
);

// Overview summary, laid out like the Deployments card: one row per
// dependency per environment, saying whether a database is available, has
// the latest schema, and is bound. Every row opens the dependency's page;
// the footer link opens the Dependencies tab.
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
  const rows = state.environments
    .filter(e => e.count > 0)
    .flatMap(({ environment, groups }) => {
      const entities = groups.flatMap(g => g.entities);
      const databaseCount = entities.filter(platformDatabase).length;
      return entities.map(dependency => ({ environment, dependency, onlyDatabase: databaseCount === 1 }));
    });
  if (rows.length === 0) {
    return null;
  }

  return (
    <InfoCard
      title="Dependencies"
      subheader="Infrastructure this service uses, and whether it's ready"
      deepLink={{ title: 'View dependencies', link: 'dependencies' }}
    >
      <Box className={classes.header}>
        <Typography variant="overline">Environment</Typography>
        <Typography variant="overline">Dependency</Typography>
        <Typography variant="overline">Status</Typography>
        <Typography variant="overline">Schema</Typography>
        <Typography variant="overline">Binding</Typography>
        <span />
      </Box>
      <List disablePadding>
        {rows.map(row => {
          const database = platformDatabase(row.dependency);
          const key = `${row.environment ?? 'all'}:${row.dependency.kind}:${row.dependency.metadata.name}`;
          return database ? (
            <PlatformDatabaseRow key={key} {...row} database={database} />
          ) : (
            <OtherDependencyRow key={key} {...row} />
          );
        })}
      </List>
    </InfoCard>
  );
};
