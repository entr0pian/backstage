import type { SchemaStatus } from '../deployments/useSchemaStatus';
import { schemaChecks } from './schemaChecks';

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);

const requested = (version: string, extra: Partial<NonNullable<SchemaStatus['requested']>> = {}) => ({
  name: 'payments',
  namespace: 'dev',
  version,
  database: 'payments-db',
  published: true,
  reason: 'Published',
  ...extra,
});

const applied = (commit: string, extra: Partial<NonNullable<SchemaStatus['applied']>> = {}) => ({
  name: 'payments-schema',
  namespace: 'dev',
  commit,
  phase: 'Applied' as const,
  lastAppliedVersion: '20261007000000',
  appliedAt: null,
  reason: 'Applied',
  ...extra,
});

const status = (s: Partial<SchemaStatus>): SchemaStatus => ({
  requested: null,
  applied: null,
  code: null,
  latest: null,
  ...s,
});

const labels = (s: SchemaStatus) =>
  Object.fromEntries((schemaChecks(s, 'payments-db') ?? []).map(c => [c.key, c.fact.label]));

describe('schemaChecks', () => {
  it('is all green when the newest version is applied and the code needs nothing newer', () => {
    expect(
      labels(
        status({
          requested: requested(NEW),
          applied: applied(NEW),
          latest: { version: NEW, createdAt: null },
          code: { version: NEW, newestMigration: '20261007000000', ahead: false },
        }),
      ),
    ).toEqual({ package: 'Published', requested: 'Resolved', applied: 'Applied', latest: 'Latest', code: 'Compatible' });
  });

  it('starts out with nothing requested or applied', () => {
    expect(labels(status({ latest: { version: NEW, createdAt: null } }))).toEqual({
      package: 'Published',
      requested: 'Not requested',
      applied: 'Nothing applied',
      latest: 'Not yet',
      code: 'Not checked',
    });
  });

  it('explains a package that is not there yet, and flags unknown reasons', () => {
    const waiting = schemaChecks(
      status({ requested: requested(NEW, { published: false, reason: 'ArtifactNotFound' }) }),
      'payments-db',
    )!.find(c => c.key === 'requested')!;
    expect(waiting.fact).toMatchObject({ label: 'Waiting', tone: 'pending' });
    expect(waiting.fact.detail).toContain('schema package');
    const odd = schemaChecks(
      status({ requested: requested(NEW, { published: false, reason: 'Boom', message: 'details' }) }),
      'payments-db',
    )!.find(c => c.key === 'requested')!;
    expect(odd.fact.tone).toBe('error');
    expect(odd.message).toBe('details');
  });

  it("shows Atlas's checking, failure and the database staying where it was", () => {
    const checking = schemaChecks(
      status({ requested: requested(NEW), applied: applied(NEW, { phase: 'Migrating', reason: 'GettingDevDB' }) }),
      'payments-db',
    )!.find(c => c.key === 'applied')!;
    expect(checking.fact.detail).toContain('throwaway database');

    const failed = schemaChecks(
      status({
        requested: requested(NEW),
        applied: applied(NEW, { phase: 'Failed', reason: 'Migrating', message: 'column "x" contains null values' }),
      }),
      'payments-db',
    )!.find(c => c.key === 'applied')!;
    expect(failed.fact).toMatchObject({ label: 'Failed', tone: 'error' });
    expect(failed.fact.detail).toContain('stays up to 20261007000000');
    expect(failed.message).toContain('null values');
  });

  it('warns when the database is behind the latest version or the deployed code', () => {
    expect(
      labels(
        status({
          requested: requested(OLD),
          applied: applied(OLD),
          latest: { version: NEW, createdAt: null },
          code: { version: NEW, newestMigration: '20261008000000', ahead: true },
        }),
      ),
    ).toMatchObject({ latest: 'Behind', code: 'Code ahead' });
  });

  it("doesn't apply to a database the environment's schema isn't for", () => {
    expect(schemaChecks(status({ requested: requested(NEW, { database: 'other-db' }) }), 'payments-db')).toBeNull();
  });
});
