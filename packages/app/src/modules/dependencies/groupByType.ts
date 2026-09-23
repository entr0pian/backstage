import type { Entity } from '@backstage/catalog-model';

// Pure grouping: dependsOn Resource entities -> { type: entities[] }.
// Generic over spec.type on purpose — see
// platform-architecture/BACKSTAGE_PART6.md's "Design Dependencies for
// future resource types": Database is the only type that exists today,
// but Bucket/Queue/etc. need zero new code here once a Resource of that
// type shows up, since the type label ("Databases", "Buckets", ...) is
// derived from the data, not hardcoded per type.
export interface DependencyGroup {
  type: string;
  label: string;
  entities: Entity[];
}

function pluralLabel(type: string): string {
  const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
  return capitalized.endsWith('s') ? capitalized : `${capitalized}s`;
}

export function groupByType(entities: Entity[]): DependencyGroup[] {
  const byType = new Map<string, Entity[]>();

  for (const entity of entities) {
    const type = entity.spec?.type as string | undefined;
    if (!type) {
      continue;
    }
    const group = byType.get(type) ?? [];
    group.push(entity);
    byType.set(type, group);
  }

  return [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, entityList]) => ({
      type,
      label: pluralLabel(type),
      entities: entityList,
    }));
}
