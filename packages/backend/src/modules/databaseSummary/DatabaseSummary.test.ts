import { buildDatabaseSummary, type DatabaseXr, type ManagedResource } from './DatabaseSummary';

const readyCond = (status = 'True', reason = 'Available', message?: string) => ({
  type: 'Ready',
  status,
  reason,
  message,
});

function paymentsDb(overrides: Partial<DatabaseXr['status']> = {}): DatabaseXr {
  return {
    metadata: { name: 'payments-db', namespace: 'management', creationTimestamp: '2026-09-24T07:39:00Z' },
    spec: {
      componentRef: { name: 'payments' },
      dbName: 'payments',
      size: 'small',
      crossplane: {
        resourceRefs: [
          { apiVersion: 'ec2.aws.m.upbound.io/v1beta1', kind: 'SecurityGroup', name: 'payments-db' },
          { apiVersion: 'kubernetes.m.crossplane.io/v1alpha1', kind: 'Object', name: 'payments-db-connection-secret' },
          { apiVersion: 'rds.aws.m.upbound.io/v1beta1', kind: 'Instance', name: 'payments-db' },
        ],
      },
    },
    status: {
      conditions: [readyCond(), { type: 'Synced', status: 'True', reason: 'ReconcileSuccess' }],
      exports: [
        {
          name: 'connection',
          type: 'Secret',
          ready: true,
          location: { provider: 'AWSSecretsManager', key: '/bindings/management/databases/payments-db' },
        },
      ],
      ...overrides,
    },
  };
}

const managed: ManagedResource[] = [
  {
    apiVersion: 'ec2.aws.m.upbound.io/v1beta1',
    kind: 'SecurityGroup',
    metadata: { name: 'payments-db' },
    status: { conditions: [readyCond(), { type: 'Synced', status: 'True', reason: 'ReconcileSuccess' }] },
  },
  {
    apiVersion: 'rds.aws.m.upbound.io/v1beta1',
    kind: 'Instance',
    metadata: { name: 'payments-db' },
    spec: { forProvider: { engine: 'postgres', engineVersion: '16', region: 'eu-west-1', identifier: 'payments-db', passwordSecretRef: { name: 'x' } } },
    status: {
      conditions: [readyCond(), { type: 'Synced', status: 'True' }],
      atProvider: {
        engine: 'postgres',
        engineVersionActual: '16.13',
        instanceClass: 'db.t3.micro',
        allocatedStorage: 20,
        status: 'available',
        availabilityZone: 'eu-west-1a',
        multiAz: false,
        storageEncrypted: true,
        address: 'payments-db.abc.eu-west-1.rds.amazonaws.com',
        port: 5432,
        arn: 'arn:aws:rds:eu-west-1:123456789012:db:payments-db',
        identifier: 'payments-db',
        region: 'eu-west-1',
      },
    },
  },
];

const releases = [
  { name: 'payments-management', namespace: 'management', environment: 'management', bindingName: 'database' },
  { name: 'other-dev', namespace: 'dev', environment: 'dev', bindingName: 'database' },
];

describe('buildDatabaseSummary', () => {
  it('summarises a ready database for a guest', () => {
    const s = buildDatabaseSummary(paymentsDb(), managed, releases, { includeSensitive: false });
    expect(s).toMatchObject({
      name: 'payments-db',
      namespace: 'management',
      component: 'payments',
      detailLevel: 'summary',
      ready: true,
      synced: true,
      problem: null,
      spec: { dbName: 'payments', size: 'small' },
      engine: {
        engine: 'postgres',
        version: '16.13',
        instanceClass: 'db.t3.micro',
        storageGb: 20,
        status: 'available',
        availabilityZone: 'eu-west-1a',
        multiAz: false,
        encrypted: true,
      },
      connection: [
        {
          name: 'connection',
          type: 'Secret',
          provider: 'AWSSecretsManager',
          key: '/bindings/management/databases/payments-db',
          ready: true,
        },
      ],
      boundBy: [
        { release: 'payments-management', namespace: 'management', environment: 'management', mountPath: '/bindings/database' },
      ],
    });
  });

  it('lists every composed resource, marking credential-bearing Objects as inferred, never read', () => {
    const s = buildDatabaseSummary(paymentsDb(), managed, releases, { includeSensitive: false });
    expect(s.resources.map(r => [r.kind, r.source, r.ready])).toEqual([
      ['SecurityGroup', 'observed', true],
      ['Object', 'inferred', true],
      ['Instance', 'observed', true],
    ]);
    expect(s.resources[1].note).toMatch(/credentials/);
  });

  it('never exposes the endpoint, ARN, port or console link to guests', () => {
    const s = buildDatabaseSummary(paymentsDb(), managed, releases, { includeSensitive: false });
    expect(s).not.toHaveProperty('endpoint');
    const json = JSON.stringify(s);
    expect(json).not.toContain('rds.amazonaws.com');
    expect(json).not.toContain('arn:aws');
    expect(json).not.toContain('5432');
  });

  it('includes the endpoint and AWS console link for the owner', () => {
    const s = buildDatabaseSummary(paymentsDb(), managed, releases, { includeSensitive: true });
    expect(s.endpoint).toEqual({
      address: 'payments-db.abc.eu-west-1.rds.amazonaws.com',
      port: 5432,
      arn: 'arn:aws:rds:eu-west-1:123456789012:db:payments-db',
      consoleUrl:
        'https://eu-west-1.console.aws.amazon.com/rds/home?region=eu-west-1#database:id=payments-db;is-cluster=false',
    });
  });

  it('explains a database still waiting to publish its connection details', () => {
    const s = buildDatabaseSummary(
      paymentsDb({
        conditions: [readyCond('False', 'Creating', 'Unready resources: push-secret')],
        exports: [{ name: 'connection', type: 'Secret', ready: false, location: { provider: 'AWSSecretsManager', key: '/bindings/management/databases/payments-db' } }],
      }),
      managed,
      releases,
      { includeSensitive: false },
    );
    expect(s.ready).toBe(false);
    expect(s.problem).toBe(
      'Still provisioning: push-secret. Waiting for the connection details to be published to Secrets Manager — services binding this database cannot start until then.',
    );
  });

  it('keeps raw provider error messages owner-only', () => {
    const failing = paymentsDb({
      conditions: [readyCond('False', 'ReconcileError', 'api error InvalidParameter: account 123456789012 ...')],
      exports: [],
    });
    const guest = buildDatabaseSummary(failing, managed, releases, { includeSensitive: false });
    expect(guest.problem).toBe('Not ready (ReconcileError).');
    expect(JSON.stringify(guest)).not.toContain('123456789012');
    const owner = buildDatabaseSummary(failing, managed, releases, { includeSensitive: true });
    expect(owner.problem).toContain('InvalidParameter');
  });

  it('marks a readable resource that could not be fetched as unknown, not ready', () => {
    const s = buildDatabaseSummary(paymentsDb(), [managed[1]], releases, { includeSensitive: false });
    const sg = s.resources.find(r => r.kind === 'SecurityGroup')!;
    expect(sg).toMatchObject({ source: 'inferred', ready: null, note: 'Could not be read.' });
  });
});
