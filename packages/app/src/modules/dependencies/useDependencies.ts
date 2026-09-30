import { RELATION_DEPENDS_ON } from '@backstage/catalog-model';
import { useEntity, useRelatedEntities } from '@backstage/plugin-catalog-react';
import { useEnvironmentOrder } from '../platformUi/environments';
import { groupByEnvironment, type EnvironmentDependencies } from './groupByEnvironment';

export type DependenciesState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'done'; environments: EnvironmentDependencies[] };

// This service's dependsOn Resources, per environment. Shared by the
// Overview card and the Dependencies tab so both always agree.
export function useDependencies(): DependenciesState {
  const { entity } = useEntity();
  const order = useEnvironmentOrder();
  const { entities, loading, error } = useRelatedEntities(entity, {
    type: RELATION_DEPENDS_ON,
    kind: 'resource',
  });
  if (loading) {
    return { status: 'loading' };
  }
  if (error) {
    return { status: 'error', error };
  }
  return { status: 'done', environments: groupByEnvironment(entities ?? [], order) };
}
