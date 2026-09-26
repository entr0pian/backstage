import type { Entity } from '@backstage/catalog-model';

// Which catalog Resource types can be bound in a Release, and how each one
// is named there. The Release's spec.bindings has one key per type
// (release-operator's ReleaseBindings), so a new dependency type is one new
// entry here plus its lines in templates/create-deployment/skeleton.
export const BINDING_TYPES: Record<string, { label: string; refAnnotation: string }> = {
  // Release spec.bindings.database: { enabled: true, ref: <Database CR name> }
  database: {
    label: 'Database',
    refAnnotation: 'platform.taskapp.io/database-name',
  },
};

// Form value: binding type -> the bound resource's name in the Release,
// e.g. { database: 'payments-db' }. A type absent from the object is unbound.
export type DependencyBindings = Record<string, string>;

export interface BindingOption {
  type: string;
  label: string;
  ref: string;
}

// The catalog Resources (from the Platform Entity Provider) a component can
// bind in one environment, grouped by binding type. Resources of a type
// with no BINDING_TYPES entry are ignored — there's no Release field for them.
export function bindingOptions(entities: Entity[]): Record<string, BindingOption[]> {
  const byType: Record<string, BindingOption[]> = {};
  for (const entity of entities) {
    const type = typeof entity.spec?.type === 'string' ? entity.spec.type : undefined;
    const binding = type ? BINDING_TYPES[type] : undefined;
    const ref = binding ? entity.metadata.annotations?.[binding.refAnnotation] : undefined;
    if (!type || !binding || !ref) {
      continue;
    }
    (byType[type] ??= []).push({ type, label: binding.label, ref });
  }
  for (const options of Object.values(byType)) {
    options.sort((a, b) => a.ref.localeCompare(b.ref));
  }
  return byType;
}

// Drops any binding that isn't offered in the current environment — the
// environment changed, or the resource is gone.
export function pruneBindings(
  value: DependencyBindings,
  options: Record<string, BindingOption[]>,
): DependencyBindings {
  return Object.fromEntries(
    Object.entries(value).filter(([type, ref]) =>
      (options[type] ?? []).some(o => o.ref === ref),
    ),
  );
}
