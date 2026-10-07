import { schemaView } from './schemaView';
import type { SchemaStatus } from './useSchemaStatus';

const A = '3f9c2e1a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e';
const B = '4a0d3f2b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f';

const status = (over: Partial<SchemaStatus>): SchemaStatus => ({
  requested: { name: 'orders', namespace: 'dev', version: A, published: true, reason: 'Published' },
  applied: {
    name: 'orders-schema',
    namespace: 'dev',
    commit: A,
    phase: 'Applied',
    lastAppliedVersion: '20261009093000',
    appliedAt: null,
    reason: 'Applied',
  },
  code: { version: B, newestMigration: '20261009093000', ahead: false },
  ...over,
});

describe('schemaView', () => {
  it('shows nothing when no schema is released here', () => {
    expect(schemaView(null)).toBeNull();
    expect(schemaView(status({ requested: null, applied: null }))).toBeNull();
  });

  it('shows an applied schema', () => {
    expect(schemaView(status({}))).toMatchObject({
      tone: 'ok',
      status: 'Applied',
      detail: 'Up to 20261009093000 · from 3f9c2e1',
      warning: null,
    });
  });

  it('shows a migration in progress', () => {
    const v = schemaView(status({ applied: { ...status({}).applied!, phase: 'Migrating', commit: B } }));
    expect(v).toMatchObject({ tone: 'running', status: 'Migrating', detail: 'Applying 4a0d3f2 · up to 20261009093000 so far' });
  });

  it('shows a failure, with the error only when the backend sent it (owners)', () => {
    const failed = { ...status({}).applied!, phase: 'Failed' as const, commit: B, reason: 'Migrating' };
    expect(schemaView(status({ applied: failed }))).toMatchObject({ tone: 'error', status: 'Failed', message: null });
    expect(schemaView(status({ applied: { ...failed, message: 'ERROR: syntax error' } }))?.message).toBe('ERROR: syntax error');
  });

  it('explains why a requested version is waiting', () => {
    const v = schemaView(
      status({ requested: { name: 'orders', namespace: 'dev', version: B, published: false, reason: 'ArtifactNotFound' } }),
    );
    expect(v).toMatchObject({ tone: 'pending', status: 'Waiting', detail: '4a0d3f2 requested' });
    expect(v?.reason).toContain('schema package');
  });

  it('warns when a bound database has no schema at all', () => {
    const v = schemaView(
      status({ requested: null, applied: null, code: { version: B, newestMigration: '20261007000000', ahead: true } }),
    );
    expect(v).toMatchObject({ tone: 'error', status: 'Not applied' });
    expect(v?.warning).toContain('but the database has none applied');
  });

  it('warns when the deployed code expects a newer migration', () => {
    const v = schemaView(status({ code: { version: B, newestMigration: '20261010000000', ahead: true } }));
    expect(v?.warning).toBe(
      'The deployed version (4a0d3f2) ships migrations up to 20261010000000, but the database has only up to 20261009093000. Apply its schema to this environment.',
    );
  });
});
