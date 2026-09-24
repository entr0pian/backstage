import { databaseEntityName, mapDatabaseToEntity } from './DatabaseEntityMapper';

describe('mapDatabaseToEntity', () => {
  it('maps a well-formed Database to a Resource entity', () => {
    const result = mapDatabaseToEntity({
      metadata: { name: 'invoice-db', namespace: 'dev' },
      spec: { componentRef: { name: 'invoice' }, dbName: 'invoice', size: 'small' },
    });

    expect('error' in result).toBe(false);
    const { entity } = result as { entity: Record<string, any> };
    expect(entity.kind).toBe('Resource');
    expect(entity.metadata.name).toBe('dev-invoice-db');
    expect(entity.metadata.namespace).toBe('default');
    expect(entity.spec.type).toBe('database');
    expect(entity.spec.dependencyOf).toEqual(['component:default/invoice']);
  });

  it('errors when spec.componentRef is missing', () => {
    const result = mapDatabaseToEntity({
      metadata: { name: 'orphan-db', namespace: 'dev' },
      spec: { dbName: 'orphan' },
    });

    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toContain('orphan-db');
  });

  it('errors when spec.componentRef.name is invalid', () => {
    const result = mapDatabaseToEntity({
      metadata: { name: 'bad-db', namespace: 'dev' },
      spec: { componentRef: { name: '' }, dbName: 'bad' },
    });

    expect('error' in result).toBe(true);
  });

  it('errors when metadata.name or metadata.namespace is missing', () => {
    expect('error' in mapDatabaseToEntity({ metadata: { namespace: 'dev' } })).toBe(true);
    expect('error' in mapDatabaseToEntity({ metadata: { name: 'x' } })).toBe(true);
  });

  it('folds the Kubernetes namespace into the entity name, not the Backstage namespace', () => {
    const result = mapDatabaseToEntity({
      metadata: { name: 'checkout-db', namespace: 'prod' },
      spec: { componentRef: { name: 'checkout' }, dbName: 'checkout' },
    });
    const { entity } = result as { entity: Record<string, any> };
    expect(entity.metadata.namespace).toBe('default');
    expect(entity.metadata.name).toBe('prod-checkout-db');
  });

  it('does not copy any sensitive fields onto the entity', () => {
    const result = mapDatabaseToEntity({
      metadata: { name: 'checkout-db', namespace: 'dev' },
      spec: { componentRef: { name: 'checkout' }, dbName: 'checkout', size: 'small' },
      // @ts-expect-error - simulating a status block that must never be copied through
      status: {
        connectionSecretRef: { name: 'checkout-db-connection', namespace: 'dev' },
        conditions: [{ type: 'Ready', status: 'True' }],
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('connectionSecretRef');
    expect(serialized).not.toContain('conditions');
  });

  it('produces distinct entities for the same database name in different components', () => {
    const a = mapDatabaseToEntity({
      metadata: { name: 'db', namespace: 'dev' },
      spec: { componentRef: { name: 'invoice' }, dbName: 'db' },
    });
    const b = mapDatabaseToEntity({
      metadata: { name: 'db', namespace: 'dev' },
      spec: { componentRef: { name: 'checkout' }, dbName: 'db' },
    });
    const entityA = (a as { entity: Record<string, any> }).entity;
    const entityB = (b as { entity: Record<string, any> }).entity;
    expect(entityA.metadata.name).toBe(entityB.metadata.name);
    expect(entityA.spec.dependencyOf).not.toEqual(entityB.spec.dependencyOf);
  });

  it('produces distinct entity names for the same logical database across environments', () => {
    expect(databaseEntityName('dev', 'checkout-db')).toBe('dev-checkout-db');
    expect(databaseEntityName('prod', 'checkout-db')).toBe('prod-checkout-db');
    expect(databaseEntityName('dev', 'checkout-db')).not.toBe(
      databaseEntityName('prod', 'checkout-db'),
    );
  });

  it('shows the CR name as title, labels the component, and keeps the unique entity name', () => {
    const { entity } = mapDatabaseToEntity({
      metadata: { name: 'payments-db', namespace: 'management' },
      spec: { componentRef: { name: 'payments' } },
    }) as { entity: Record<string, any> };
    expect(entity.metadata.name).toBe('management-payments-db');
    expect(entity.metadata.title).toBe('payments-db');
    expect(entity.metadata.labels).toEqual({ 'platform.taskapp.io/component': 'payments' });
    expect(entity.metadata.annotations['platform.taskapp.io/database-name']).toBe('payments-db');
  });

  it('takes the owner from the owning Component, falling back to user:guest', () => {
    const database = {
      metadata: { name: 'payments-db', namespace: 'management' },
      spec: { componentRef: { name: 'payments' } },
    };
    const owned = mapDatabaseToEntity(database, { owner: 'payments-team' }) as { entity: Record<string, any> };
    expect(owned.entity.spec.owner).toBe('payments-team');
    const unowned = mapDatabaseToEntity(database) as { entity: Record<string, any> };
    expect(unowned.entity.spec.owner).toBe('user:guest');
  });

  it('links to the environment folder defining it, only when a GitOps repo is configured', () => {
    const database = {
      metadata: { name: 'payments-db', namespace: 'management' },
      spec: { componentRef: { name: 'payments' } },
    };
    const linked = mapDatabaseToEntity(database, {
      gitopsRepoUrl: 'https://github.com/entr0pian/application-repositories/',
    }) as { entity: Record<string, any> };
    expect(linked.entity.metadata.links).toEqual([
      {
        url: 'https://github.com/entr0pian/application-repositories/tree/main/platform/environments/management',
        title: 'Definition in Git',
      },
    ]);
    const unlinked = mapDatabaseToEntity(database) as { entity: Record<string, any> };
    expect(unlinked.entity.metadata.links).toBeUndefined();
  });
});
