import { Link as RouterLink } from 'react-router-dom';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import StorageIcon from '@material-ui/icons/Storage';
import { LinkButton, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { usePermission } from '@backstage/plugin-permission-react';
import { taskCreatePermission } from '@backstage/plugin-scaffolder-common/alpha';
import { addDatabaseHref } from '../platformActions/addDatabaseHref';
import { EnvironmentCard, PlatformEmptyState, accentGradient, environmentAccent } from '../platformUi';
import { displayFont } from '../theme/themes';
import { DependencyList } from './DependencyList';
import { useDependencies } from './useDependencies';

const useStyles = makeStyles(theme => ({
  // An environment with nothing in it yet: a dashed, inviting tile rather
  // than a full empty card.
  ghost: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2, 2.5),
    borderRadius: 18,
    border: `1.5px dashed ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    textDecoration: 'none !important',
    transition: 'transform 250ms cubic-bezier(.34,1.56,.64,1), border-color 200ms ease, background-color 200ms ease, color 200ms ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: theme.palette.primary.main,
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.type === 'dark' ? 'rgba(129,140,248,0.08)' : 'rgba(99,102,241,0.05)',
    },
    '&:hover $plus': { transform: 'rotate(90deg) scale(1.08)' },
  },
  plus: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    transition: 'transform 300ms cubic-bezier(.34,1.56,.64,1)',
  },
  ghostTitle: { fontFamily: displayFont, fontWeight: 700, fontSize: '1rem' },
}));

// The Dependencies tab (shown only once there's at least one): a card per
// environment that has dependencies, in the configured order. The same
// database name can exist in every environment; each card holds only its
// own. For the owner, every other environment is a dashed tile that adds a
// database there.
export const DependenciesContent = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const state = useDependencies();
  // Adding runs a scaffolder template, which guests can't.
  const { allowed: canAdd } = usePermission({ permission: taskCreatePermission });

  if (state.status === 'loading') {
    return <Progress />;
  }
  if (state.status === 'error') {
    return <ResponseErrorPanel error={state.error} />;
  }

  const used = state.environments.filter(e => e.count > 0);
  const unused = state.environments.filter(e => e.count === 0 && e.environment);

  if (used.length === 0) {
    return (
      <PlatformEmptyState
        icon={<StorageIcon />}
        title="No dependencies yet"
        description="This service doesn't use any platform infrastructure in any environment."
        action={
          canAdd && (
            <LinkButton
              to={addDatabaseHref(entity.metadata.name)}
              color="primary"
              variant="contained"
              startIcon={<StorageIcon />}
            >
              Add database
            </LinkButton>
          )
        }
      />
    );
  }

  return (
    <Grid container spacing={3}>
      {used.map(({ environment, groups, count }) =>
        environment ? (
          <Grid item xs={12} key={environment}>
            <EnvironmentCard
              environment={environment}
              subheader={`${count} ${count === 1 ? 'dependency' : 'dependencies'}`}
              action={
                canAdd ? (
                  <LinkButton
                    to={addDatabaseHref(entity.metadata.name, environment)}
                    color="primary"
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    style={{ marginTop: 16, marginRight: 16 }}
                  >
                    Add database
                  </LinkButton>
                ) : undefined
              }
            >
              <DependencyList groups={groups} />
            </EnvironmentCard>
          </Grid>
        ) : (
          <Grid item xs={12} key="all">
            <EnvironmentCard environment="all environments" subheader="Declared in catalog-info.yaml">
              <DependencyList groups={groups} />
            </EnvironmentCard>
          </Grid>
        ),
      )}
      {canAdd &&
        unused.map(({ environment }) => (
          <Grid item xs={12} md={6} key={environment}>
            <RouterLink to={addDatabaseHref(entity.metadata.name, environment!)} className={classes.ghost}>
              <span className={classes.plus} style={{ background: accentGradient(environmentAccent(environment!)) }}>
                <AddIcon />
              </span>
              <span>
                <Typography component="span" className={classes.ghostTitle} display="block">
                  Add a database in {environment}
                </Typography>
                <Typography component="span" variant="caption" display="block">
                  Nothing provisioned here yet
                </Typography>
              </span>
            </RouterLink>
          </Grid>
        ))}
    </Grid>
  );
};
