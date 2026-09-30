import type { Entity } from '@backstage/catalog-model';
import { compareEnvironments } from '../platformUi/environments';
import { groupByType, type DependencyGroup } from './groupByType';

export const ENVIRONMENT_ANNOTATION = 'platform.taskapp.io/environment';

export interface EnvironmentDependencies {
  // null: dependencies with no environment (declared in catalog-info.yaml
  // rather than provisioned by the platform) — they apply everywhere.
  environment: string | null;
  groups: DependencyGroup[];
  count: number;
}

// Pure grouping: dependsOn Resources -> one entry per environment, each
// grouped by type. Every configured environment is listed, even with no
// dependencies (so the tab can offer to add one there), in the configured
// order; environments only the data knows about follow, then the
// environment-less ones.
export function groupByEnvironment(entities: Entity[], environments: string[]): EnvironmentDependencies[] {
  const byEnvironment = new Map<string | null, Entity[]>(environments.map(env => [env, []]));
  for (const entity of entities) {
    const environment = entity.metadata.annotations?.[ENVIRONMENT_ANNOTATION] ?? null;
    byEnvironment.set(environment, [...(byEnvironment.get(environment) ?? []), entity]);
  }
  const compare = compareEnvironments(environments);
  const order = (a: string | null, b: string | null) => {
    if (a === null || b === null) {
      return Number(a === null) - Number(b === null);
    }
    return compare(a, b);
  };
  return [...byEnvironment.entries()]
    .sort(([a], [b]) => order(a, b))
    .map(([environment, list]) => {
      const groups = groupByType(list);
      return { environment, groups, count: groups.reduce((n, g) => n + g.entities.length, 0) };
    })
    .filter(e => e.environment !== null || e.count > 0);
}
