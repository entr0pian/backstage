import { InfoCard, LinkButton } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { addDatabaseHref } from './addDatabaseHref';

export const PlatformActionsCard = () => {
  const { entity } = useEntity();

  return (
    <InfoCard title="Platform Actions">
      <LinkButton to={addDatabaseHref(entity.metadata.name)} color="primary">
        + Add Database
      </LinkButton>
    </InfoCard>
  );
};
