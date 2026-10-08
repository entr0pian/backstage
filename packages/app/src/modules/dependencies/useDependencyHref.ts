import { useRouteRef } from '@backstage/core-plugin-api';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';

// The catalog page of a dependency, so a whole row (name and status) can be
// one link to it rather than only its name.
export function useDependencyHref(): (dependency: Entity) => string {
  const entityRoute = useRouteRef(entityRouteRef);
  return dependency =>
    entityRoute({
      namespace: dependency.metadata.namespace ?? 'default',
      kind: dependency.kind.toLocaleLowerCase('en-US'),
      name: dependency.metadata.name,
    });
}

export const dependencyTitle = (dependency: Entity) => dependency.metadata.title ?? dependency.metadata.name;
