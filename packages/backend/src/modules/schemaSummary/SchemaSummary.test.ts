import {
  atlasMigrationPhase,
  buildSchemaSummary,
  codeSchemaCheck,
  compareVersions,
  newestMigrationVersion,
  type K8sAtlasMigration,
} from './SchemaSummary';
import {
  committedSchemaPath,
  migrationChangesFromCompare,
  migrationNamesFromListing,
  parseCommittedSchemaVersion,
} from './SchemaChanges';

const SHA = '3f9c2e1a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e';

const migration = (status: K8sAtlasMigration['status'], generation = 1): K8sAtlasMigration => ({
  metadata: {
    name: 'orders-schema',
    namespace: 'dev',
    generation,
    annotations: { 'platform.taskapp.io/schema-version': SHA },
  },
  status,
});

const applied = {
  observedGeneration: 1,
  lastAppliedVersion: '20261009093000',
  lastApplied: 1791370000,
  conditions: [
    { type: 'Ready', status: 'True', reason: 'Applied' },
    { type: 'Reconciling', status: 'False', reason: 'Applied' },
    { type: 'Stalled', status: 'False', reason: 'Applied' },
  ],
};

const failed = {
  observedGeneration: 1,
  failed: 3,
  conditions: [
    { type: 'Ready', status: 'False', reason: 'Migrating', message: 'ERROR: column "price" contains null values' },
    { type: 'Reconciling', status: 'False', reason: 'Migrating' },
    { type: 'Stalled', status: 'True', reason: 'Migrating', message: 'ERROR: column "price" contains null values' },
  ],
};

describe('atlasMigrationPhase', () => {
  it('follows the same rules as the Argo CD health check', () => {
    expect(atlasMigrationPhase(migration(undefined))).toBe('Pending');
    expect(atlasMigrationPhase(migration(applied))).toBe('Applied');
    expect(atlasMigrationPhase(migration(failed))).toBe('Failed');
    expect(atlasMigrationPhase(migration(applied, 2))).toBe('Migrating');
    expect(
      atlasMigrationPhase(
        migration({
          observedGeneration: 1,
          conditions: [
            { type: 'Ready', status: 'False', reason: 'GettingDevDB' },
            { type: 'Reconciling', status: 'True' },
            { type: 'Stalled', status: 'False' },
          ],
        }),
      ),
    ).toBe('Migrating');
  });
});

describe('buildSchemaSummary', () => {
  const databaseSchema = {
    metadata: { name: 'orders-db', namespace: 'dev' },
    spec: { componentRef: { name: 'orders' }, version: SHA },
    status: {
      conditions: [{ type: 'Ready', status: 'True', reason: 'Published', message: 'written' }],
      database: { name: 'orders-db' },
    },
  };

  it('summarises what was asked for and what was applied', () => {
    expect(buildSchemaSummary(databaseSchema, migration(applied), { includeSensitive: true })).toEqual({
      requested: {
        name: 'orders-db',
        namespace: 'dev',
        version: SHA,
        database: 'orders-db',
        published: true,
        reason: 'Published',
        message: 'written',
      },
      applied: {
        name: 'orders-schema',
        namespace: 'dev',
        commit: SHA,
        phase: 'Applied',
        lastAppliedVersion: '20261009093000',
        appliedAt: '2026-10-07T10:46:40.000Z',
        reason: 'Applied',
        message: null,
      },
    });
  });

  it('names the database from the spec until schema-operator has resolved one', () => {
    const pending = { ...databaseSchema, spec: { ...databaseSchema.spec, databaseRef: { name: 'orders-main' } }, status: {} };
    expect(buildSchemaSummary(pending, null, { includeSensitive: false }).requested?.database).toBe('orders-main');
    const unresolved = { ...databaseSchema, status: {} };
    expect(buildSchemaSummary(unresolved, null, { includeSensitive: false }).requested?.database).toBeNull();
  });

  it('shows the failure reason to everyone and the SQL error to owners only', () => {
    const guest = buildSchemaSummary(null, migration(failed), { includeSensitive: false });
    expect(guest.applied).toMatchObject({ phase: 'Failed', reason: 'Migrating' });
    expect(guest.applied).not.toHaveProperty('message');
    const owner = buildSchemaSummary(null, migration(failed), { includeSensitive: true });
    expect(owner.applied?.message).toContain('contains null values');
  });

  it('is empty when nothing exists yet', () => {
    expect(buildSchemaSummary(null, null, { includeSensitive: true })).toEqual({ requested: null, applied: null });
  });
});

describe('migration versions', () => {
  it('finds the newest version among migration files', () => {
    expect(
      newestMigrationVersion(['20261007000000_create_items.sql', '20261009093000_add_price.sql', 'atlas.sum', 'README.md']),
    ).toBe('20261009093000');
    expect(newestMigrationVersion(['atlas.sum'])).toBeNull();
  });

  it('compares versions numerically', () => {
    expect(compareVersions('20261009093000', '20261007000000')).toBeGreaterThan(0);
    expect(compareVersions('2', '10')).toBeLessThan(0);
    expect(compareVersions('0010', '10')).toBe(0);
  });
});

describe('migration changes', () => {
  it('keeps only migration files under migrations/, in apply order', () => {
    expect(
      migrationChangesFromCompare([
        { filename: 'migrations/20261009093000_add_price.sql', status: 'added' },
        { filename: 'migrations/atlas.sum', status: 'modified' },
        { filename: 'cmd/server/main.go', status: 'modified' },
        { filename: 'migrations/20261008000000_add_index.sql', status: 'added' },
      ]),
    ).toEqual([
      { name: '20261008000000_add_index.sql', status: 'added' },
      { name: '20261009093000_add_price.sql', status: 'added' },
    ]);
  });

  it('lists the migration files in a directory', () => {
    expect(
      migrationNamesFromListing([
        { name: 'atlas.sum', type: 'file' },
        { name: '20261009093000_add_price.sql', type: 'file' },
        { name: '20261007000000_create_items.sql', type: 'file' },
        { name: 'old', type: 'dir' },
      ]),
    ).toEqual(['20261007000000_create_items.sql', '20261009093000_add_price.sql']);
  });
});

describe('committed DatabaseSchema', () => {
  it('is read from the environment directory', () => {
    expect(committedSchemaPath('orders', 'dev')).toBe('platform/environments/dev/orders-db-schema.yaml');
  });

  it('reads spec.version, and treats anything else as no schema released', () => {
    expect(
      parseCommittedSchemaVersion(`apiVersion: platform.taskapp.io/v1alpha1\nkind: DatabaseSchema\nspec:\n  version: ${SHA}\n`),
    ).toBe(SHA);
    expect(parseCommittedSchemaVersion(null)).toBeNull();
    expect(parseCommittedSchemaVersion(`kind: Release\nspec:\n  version: ${SHA}`)).toBeNull();
    expect(parseCommittedSchemaVersion('kind: DatabaseSchema\nspec:\n  version: abc')).toBeNull();
    expect(parseCommittedSchemaVersion(': not yaml : [')).toBeNull();
  });
});

describe('codeSchemaCheck', () => {
  const files = ['20261007000000_create_items.sql', '20261009093000_add_price.sql'];
  const appliedAt = (lastAppliedVersion: string | null) =>
    ({ name: 'x', namespace: 'dev', commit: SHA, phase: 'Applied', lastAppliedVersion, appliedAt: null, reason: null }) as const;

  it('flags code that expects a migration the database has not applied', () => {
    expect(codeSchemaCheck(SHA, files, appliedAt('20261007000000'))).toEqual({
      version: SHA,
      newestMigration: '20261009093000',
      ahead: true,
    });
    expect(codeSchemaCheck(SHA, files, null).ahead).toBe(true);
  });

  it('is fine when the database is at or past what the code ships', () => {
    expect(codeSchemaCheck(SHA, files, appliedAt('20261009093000')).ahead).toBe(false);
    expect(codeSchemaCheck(SHA, files, appliedAt('20261010000000')).ahead).toBe(false);
    expect(codeSchemaCheck(SHA, [], null)).toEqual({ version: SHA, newestMigration: null, ahead: false });
  });
});
