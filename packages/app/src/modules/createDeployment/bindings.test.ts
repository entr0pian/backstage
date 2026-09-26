import type { Entity } from '@backstage/catalog-model';
import { bindingOptions, pruneBindings } from './bindings';

const resource = (name: string, type: string, annotations: Record<string, string> = {}): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Resource',
  metadata: { name, annotations },
  spec: { type },
});

describe('bindingOptions', () => {
  it('groups bindable resources by type, using the Release ref annotation', () => {
    const options = bindingOptions([
      resource('management-payments-db', 'database', {
        'platform.taskapp.io/database-name': 'payments-db',
      }),
    ]);
    expect(options).toEqual({
      database: [{ type: 'database', label: 'Database', ref: 'payments-db' }],
    });
  });

  it('ignores resource types the Release has no binding for, and resources without a ref', () => {
    const options = bindingOptions([
      resource('some-bucket', 'bucket', { 'platform.taskapp.io/database-name': 'x' }),
      resource('management-orphan', 'database'),
    ]);
    expect(options).toEqual({});
  });
});

describe('pruneBindings', () => {
  const options = {
    database: [{ type: 'database', label: 'Database', ref: 'payments-db' }],
  };

  it('keeps bindings still offered in the environment', () => {
    expect(pruneBindings({ database: 'payments-db' }, options)).toEqual({ database: 'payments-db' });
  });

  it('drops bindings not offered in the environment', () => {
    expect(pruneBindings({ database: 'other-db' }, options)).toEqual({});
    expect(pruneBindings({ database: 'payments-db' }, {})).toEqual({});
  });
});
