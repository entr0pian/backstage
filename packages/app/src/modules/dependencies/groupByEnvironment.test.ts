import type { Entity } from '@backstage/catalog-model';
import { groupByEnvironment } from './groupByEnvironment';

function resource(name: string, type: string, environment?: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name,
      ...(environment ? { annotations: { 'platform.taskapp.io/environment': environment } } : {}),
    },
    spec: { type },
  } as Entity;
}

describe('groupByEnvironment', () => {
  it('keeps same-named dependencies of different environments apart', () => {
    const result = groupByEnvironment(
      [resource('dev-payments-db', 'database', 'dev'), resource('management-payments-db', 'database', 'management')],
      ['management', 'dev'],
    );
    expect(result.map(e => [e.environment, e.groups[0].entities.map(x => x.metadata.name)])).toEqual([
      ['management', ['management-payments-db']],
      ['dev', ['dev-payments-db']],
    ]);
  });

  it('lists configured environments without dependencies as empty', () => {
    const result = groupByEnvironment([resource('dev-payments-db', 'database', 'dev')], ['management', 'dev']);
    expect(result.map(e => [e.environment, e.count])).toEqual([
      ['management', 0],
      ['dev', 1],
    ]);
  });

  it('adds unconfigured environments after, and environment-less dependencies last', () => {
    const result = groupByEnvironment(
      [resource('shared-bucket', 'bucket'), resource('staging-db', 'database', 'staging')],
      ['management'],
    );
    expect(result.map(e => e.environment)).toEqual(['management', 'staging', null]);
  });
});
