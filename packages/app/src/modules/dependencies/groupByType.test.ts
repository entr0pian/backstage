import { groupByType } from './groupByType';
import type { Entity } from '@backstage/catalog-model';

function resource(name: string, type: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: { name },
    spec: { type },
  } as Entity;
}

describe('groupByType', () => {
  it('groups entities by spec.type, sorted by type', () => {
    const result = groupByType([
      resource('payment-events', 'queue'),
      resource('management-payments-db', 'database'),
    ]);
    expect(result.map(g => g.type)).toEqual(['database', 'queue']);
  });

  it('derives a pluralized label from the type, not a hardcoded map', () => {
    const result = groupByType([resource('invoices', 'bucket')]);
    expect(result).toEqual([
      { type: 'bucket', label: 'Buckets', entities: [expect.objectContaining({ metadata: { name: 'invoices' } })] },
    ]);
  });

  it('does not pluralize a type that already ends in s', () => {
    const result = groupByType([resource('x', 'queues')]);
    expect(result[0].label).toBe('Queues');
  });

  it('omits entities with no spec.type rather than crashing', () => {
    const untyped: Entity = { apiVersion: 'backstage.io/v1alpha1', kind: 'Resource', metadata: { name: 'x' }, spec: {} };
    const result = groupByType([untyped]);
    expect(result).toEqual([]);
  });

  it('returns an empty list for no dependencies, not an error', () => {
    expect(groupByType([])).toEqual([]);
  });

  it('groups multiple entities of the same type together', () => {
    const result = groupByType([resource('db-a', 'database'), resource('db-b', 'database')]);
    expect(result).toHaveLength(1);
    expect(result[0].entities).toHaveLength(2);
  });
});
