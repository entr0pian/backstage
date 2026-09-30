import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import StorageIcon from '@material-ui/icons/Storage';
import { InfoCard, LinkButton, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { usePermission } from '@backstage/plugin-permission-react';
import { taskCreatePermission } from '@backstage/plugin-scaffolder-common/alpha';
import { addDatabaseHref } from '../platformActions/addDatabaseHref';
import { DependencyList } from './DependencyList';
import { useDependencies } from './useDependencies';

// The Dependencies tab: one card per environment, in the configured order,
// each listing what the service uses there. The same database name can
// exist in every environment; each card holds only its own. An environment
// without dependencies still gets a card, so the owner can add one there.
export const DependenciesContent = () => {
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

  return (
    <Grid container spacing={3}>
      {state.environments.map(({ environment, groups, count }) => (
        <Grid item xs={12} key={environment ?? 'all'}>
          <InfoCard
            title={environment ?? 'All environments'}
            subheader={
              environment
                ? `${count || 'No'} ${count === 1 ? 'dependency' : 'dependencies'} in ${environment}`
                : 'Declared in catalog-info.yaml, not tied to one environment'
            }
            action={
              canAdd && environment ? (
                <LinkButton
                  to={addDatabaseHref(entity.metadata.name, environment)}
                  color="primary"
                  variant="outlined"
                  size="small"
                  startIcon={<StorageIcon />}
                  style={{ marginTop: 16, marginRight: 16 }}
                >
                  Add database
                </LinkButton>
              ) : undefined
            }
          >
            {count > 0 ? (
              <DependencyList groups={groups} />
            ) : (
              <Typography variant="body2" color="textSecondary">
                This service uses no platform infrastructure in {environment}.
              </Typography>
            )}
          </InfoCard>
        </Grid>
      ))}
    </Grid>
  );
};
