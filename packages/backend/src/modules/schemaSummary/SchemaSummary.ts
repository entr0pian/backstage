// Pure mapping for a component's database schema in one environment: what
// the platform was asked for (the DatabaseSchema on management) and what the
// database actually has (the AtlasMigration on the workload cluster, rendered
// by the database-schema chart). No I/O, so it's unit-testable.
//
// Guest-safe by default: condition reasons are shown to everyone, condition
// messages (Atlas's carry the failing SQL and the database's error) only to
// owners, the same split as the environment summary's events.

export interface K8sCondition {
  type?: string;
  status?: string;
  reason?: string;
  message?: string;
}

// platform.taskapp.io/v1alpha1 DatabaseSchema, as read from management.
export interface DatabaseSchemaResource {
  metadata?: { name?: string; namespace?: string; generation?: number };
  spec?: { componentRef?: { name?: string }; version?: string };
  status?: { observedGeneration?: number; conditions?: K8sCondition[] };
}

// db.atlasgo.io/v1alpha1 AtlasMigration (Atlas Operator), as read from the
// workload cluster. Only status and identity are used.
export interface K8sAtlasMigration {
  metadata?: {
    name?: string;
    namespace?: string;
    generation?: number;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  status?: {
    observedGeneration?: number;
    conditions?: K8sCondition[];
    lastAppliedVersion?: string;
    // Unix seconds of the last successful apply.
    lastApplied?: number;
    failed?: number;
  };
}

// The service commit the migrations came from, stamped by the
// database-schema chart.
export const SCHEMA_VERSION_ANNOTATION = 'platform.taskapp.io/schema-version';

export type SchemaPhase = 'Pending' | 'Migrating' | 'Applied' | 'Failed';

export interface SchemaSummary {
  // The DatabaseSchema: which commit's migrations the environment should have.
  requested: {
    name: string;
    namespace: string;
    version: string;
    // Ready=True: schema-operator has published the pointer for it.
    published: boolean | null;
    reason: string | null;
    message?: string | null; // owner only
  } | null;
  // The AtlasMigration: what the database has.
  applied: {
    name: string;
    namespace: string;
    // The commit whose package is deployed (not necessarily applied yet:
    // see phase).
    commit: string | null;
    phase: SchemaPhase;
    // Newest migration file version applied, e.g. 20261009093000.
    lastAppliedVersion: string | null;
    appliedAt: string | null;
    reason: string | null;
    message?: string | null; // owner only
  } | null;
}

const condition = (conditions: K8sCondition[] | undefined, type: string) =>
  (conditions ?? []).find(c => c.type === type);

// Mirrors the Argo CD health check for AtlasMigration (install-argocd
// values.yaml), so the portal and Argo CD never disagree.
export function atlasMigrationPhase(am: K8sAtlasMigration): SchemaPhase {
  const conditions = am.status?.conditions;
  if (!conditions || conditions.length === 0) {
    return 'Pending';
  }
  const generation = am.metadata?.generation;
  const observed = am.status?.observedGeneration;
  if (generation !== undefined && observed !== undefined && observed < generation) {
    return 'Migrating';
  }
  if (condition(conditions, 'Stalled')?.status === 'True') {
    return 'Failed';
  }
  if (condition(conditions, 'Ready')?.status === 'True') {
    return 'Applied';
  }
  return 'Migrating';
}

export function buildSchemaSummary(
  databaseSchema: DatabaseSchemaResource | null,
  atlasMigration: K8sAtlasMigration | null,
  options: { includeSensitive: boolean },
): SchemaSummary {
  const owner = options.includeSensitive;
  let requested: SchemaSummary['requested'] = null;
  if (databaseSchema?.metadata?.name && databaseSchema.metadata.namespace) {
    const ready = condition(databaseSchema.status?.conditions, 'Ready');
    requested = {
      name: databaseSchema.metadata.name,
      namespace: databaseSchema.metadata.namespace,
      version: databaseSchema.spec?.version ?? '',
      published: ready ? ready.status === 'True' : null,
      reason: ready?.reason ?? null,
      ...(owner ? { message: ready?.message ?? null } : {}),
    };
  }

  let applied: SchemaSummary['applied'] = null;
  if (atlasMigration?.metadata?.name && atlasMigration.metadata.namespace) {
    const phase = atlasMigrationPhase(atlasMigration);
    // The condition that explains the phase: Stalled when failed, else Ready.
    const explaining =
      phase === 'Failed'
        ? condition(atlasMigration.status?.conditions, 'Stalled')
        : condition(atlasMigration.status?.conditions, 'Ready');
    const lastApplied = atlasMigration.status?.lastApplied;
    applied = {
      name: atlasMigration.metadata.name,
      namespace: atlasMigration.metadata.namespace,
      commit: atlasMigration.metadata.annotations?.[SCHEMA_VERSION_ANNOTATION] ?? null,
      phase,
      lastAppliedVersion: atlasMigration.status?.lastAppliedVersion || null,
      appliedAt: lastApplied ? new Date(lastApplied * 1000).toISOString() : null,
      reason: explaining?.reason ?? null,
      ...(owner ? { message: explaining?.message ?? null } : {}),
    };
  }

  return { requested, applied };
}

// The newest migration version in a directory listing: Atlas versions are the
// file name's leading digits (20261009093000_add_price.sql -> 20261009093000),
// applied in that order. null when there are no migration files.
export function newestMigrationVersion(fileNames: string[]): string | null {
  let newest: string | null = null;
  for (const name of fileNames) {
    const match = name.match(/^(\d+)_.*\.sql$/);
    if (match && (newest === null || compareVersions(match[1], newest) > 0)) {
      newest = match[1];
    }
  }
  return newest;
}

// Numeric comparison of two digit strings of possibly different lengths.
export function compareVersions(a: string, b: string): number {
  const x = a.replace(/^0+/, '');
  const y = b.replace(/^0+/, '');
  if (x.length !== y.length) {
    return x.length - y.length;
  }
  if (x === y) {
    return 0;
  }
  return x < y ? -1 : 1;
}

export interface CodeSchemaCheck {
  // The commit the environment's Release deploys.
  version: string;
  // Newest migration file version in that commit's migrations/; null when it
  // has none.
  newestMigration: string | null;
  // The deployed code expects a migration the database hasn't applied: the
  // schema should be applied before (or with) this version of the code.
  ahead: boolean;
}

// Compares the migrations a version of the code ships with what the database
// has applied. "Applied" is only trusted once the AtlasMigration reports
// Applied; while it's migrating or failed, lastAppliedVersion is the last
// good one, which is exactly what the database has.
export function codeSchemaCheck(
  version: string,
  migrationFiles: string[],
  applied: SchemaSummary['applied'],
): CodeSchemaCheck {
  const newestMigration = newestMigrationVersion(migrationFiles);
  const databaseHas = applied?.lastAppliedVersion ?? null;
  const ahead = newestMigration !== null && (databaseHas === null || compareVersions(newestMigration, databaseHas) > 0);
  return { version, newestMigration, ahead };
}
