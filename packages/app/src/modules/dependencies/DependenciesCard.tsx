import { InfoCard, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { RELATION_DEPENDS_ON } from '@backstage/catalog-model';
import {
  EntityRefLink,
  useEntity,
  useRelatedEntities,
} from '@backstage/plugin-catalog-react';
import { groupByType } from './groupByType';

// Renders the dependsOn relations PlatformEntityProvider already publishes
// (Database -> Component, via spec.dependencyOf — see
// modules/platformEntityProvider/DatabaseEntityMapper.ts). No new
// discovery logic here — Catalog relations remain the source of truth, per
// platform-architecture/BACKSTAGE_PART6.md. Renders nothing at all when
// there are no dependencies, rather than an empty card — see that doc's
// "Empty-state philosophy".
export const DependenciesCard = () => {
  const { entity } = useEntity();
  const { entities, loading, error } = useRelatedEntities(entity, {
    type: RELATION_DEPENDS_ON,
    kind: 'resource',
  });

  if (loading) {
    return (
      <InfoCard title="Dependencies">
        <Progress />
      </InfoCard>
    );
  }
  if (error) {
    return (
      <InfoCard title="Dependencies">
        <ResponseErrorPanel error={error} />
      </InfoCard>
    );
  }
  if (!entities || entities.length === 0) {
    return null;
  }

  const groups = groupByType(entities);
  if (groups.length === 0) {
    return null;
  }

  return (
    <InfoCard title="Dependencies">
      {groups.map(group => (
        <div key={group.type}>
          <strong>{group.label}</strong>
          <ul>
            {group.entities.map(dependency => (
              <li key={`${dependency.kind}:${dependency.metadata.namespace}/${dependency.metadata.name}`}>
                <EntityRefLink entityRef={dependency} />
                {dependency.metadata.annotations?.['platform.taskapp.io/environment'] && (
                  <> ({dependency.metadata.annotations['platform.taskapp.io/environment']})</>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </InfoCard>
  );
};
