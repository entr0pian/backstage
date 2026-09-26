import Box from '@material-ui/core/Box';
import { InfoCard, LinkButton } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { usePermission } from '@backstage/plugin-permission-react';
import { taskCreatePermission } from '@backstage/plugin-scaffolder-common/alpha';
import { addDatabaseHref } from './addDatabaseHref';
import { createDeploymentHref } from './createDeploymentHref';

export const PlatformActionsCard = () => {
  const { entity } = useEntity();
  // Every action here runs a scaffolder template, which guests can't — hide
  // the whole card rather than show buttons that end in a 403.
  const { allowed } = usePermission({ permission: taskCreatePermission });

  if (!allowed) {
    return null;
  }

  return (
    <InfoCard title="Platform Actions">
      <Box display="flex" flexWrap="wrap" style={{ gap: 8 }}>
        <LinkButton to={createDeploymentHref(entity.metadata.name)} color="primary" variant="contained">
          Create deployment
        </LinkButton>
        <LinkButton to={addDatabaseHref(entity.metadata.name)} color="primary">
          + Add Database
        </LinkButton>
      </Box>
    </InfoCard>
  );
};
