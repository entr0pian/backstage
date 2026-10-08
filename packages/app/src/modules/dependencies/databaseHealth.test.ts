import type { SchemaStatus } from '../deployments/useSchemaStatus';
import { availabilityFact, bindingFact, schemaFact } from './databaseHealth';

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

const applied = (commit: string, phase: NonNullable<SchemaStatus['applied']>['phase'] = 'Applied') => ({
  name: 'payments-schema',
  namespace: 'dev',
  commit,
  phase,
  lastAppliedVersion: '20261007000000',
  appliedAt: null,
  reason: null,
});

const status = (s: Partial<SchemaStatus>): SchemaStatus => ({
  requested: null,
  applied: null,
  code: null,
  latest: null,
  ...s,
});

describe('availabilityFact', () => {
  it('tells a database that is still coming up from a broken one', () => {
    expect(availabilityFact({ ready: true, problem: null }).label).toBe('Available');
    expect(availabilityFact({ ready: false, problem: 'Still provisioning: instance.' }).tone).toBe('running');
    expect(availabilityFact({ ready: false, problem: 'Not ready (ReconcileError).' })).toMatchObject({
      label: 'Not available',
      tone: 'error',
    });
    expect(availabilityFact({ ready: null, problem: null }).tone).toBe('pending');
  });
});

describe('bindingFact', () => {
  const boundBy = [{ release: 'payments-dev', namespace: 'dev', environment: 'dev', mountPath: '/bindings/database' }];
  it('is bound only by a Release of this environment', () => {
    expect(bindingFact({ boundBy }, 'dev')).toMatchObject({ label: 'Bound', tone: 'ok' });
    expect(bindingFact({ boundBy }, 'prod')).toMatchObject({ label: 'Not bound', tone: 'neutral' });
  });
});

describe('schemaFact', () => {
  const latest = { version: NEW, createdAt: null };

  it('is up to date when the newest published version is applied', () => {
    expect(schemaFact(status({ requested: requested(NEW), applied: applied(NEW), latest }), 'payments-db', true))
      .toMatchObject({ label: 'Schema up to date', tone: 'ok' });
  });

  it('warns when a newer version is published than the one applied', () => {
    expect(schemaFact(status({ requested: requested(OLD), applied: applied(OLD), latest }), 'payments-db', true))
      .toMatchObject({ label: 'Schema behind latest', tone: 'warning' });
  });

  it('shows a requested version on its way, or waiting for its package', () => {
    expect(schemaFact(status({ requested: requested(NEW), applied: applied(OLD), latest }), 'payments-db', true)?.label)
      .toBe('Schema applying');
    expect(
      schemaFact(status({ requested: requested(NEW, { published: false, reason: 'ArtifactNotFound' }), latest }), 'payments-db', true),
    ).toMatchObject({ label: 'Schema waiting', detail: 'ArtifactNotFound' });
  });

  it('reports a failed migration', () => {
    expect(schemaFact(status({ requested: requested(NEW), applied: applied(NEW, 'Failed'), latest }), 'payments-db', true)?.tone)
      .toBe('error');
  });

  it('separates "never applied" from "nothing to apply"', () => {
    expect(schemaFact(status({ latest }), 'payments-db', true)?.label).toBe('Schema not applied');
    expect(schemaFact(status({}), 'payments-db', true)?.label).toBe('No schema');
  });

  it('says nothing about a database the schema is not for', () => {
    expect(schemaFact(status({ requested: requested(NEW), applied: applied(NEW), latest }), 'payments-cache', false)).toBeNull();
    expect(schemaFact(status({ latest }), 'payments-db', false)).toBeNull();
    expect(schemaFact(null, 'payments-db', true)).toBeNull();
  });

  it('still reports what was applied when the latest version is unknown', () => {
    expect(schemaFact(status({ requested: requested(NEW), applied: applied(NEW) }), 'payments-db', true))
      .toMatchObject({ label: 'Schema applied', tone: 'ok' });
  });
});
