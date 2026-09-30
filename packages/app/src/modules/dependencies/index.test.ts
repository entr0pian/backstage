import type { Entity } from '@backstage/catalog-model';
import { hasDependencies } from './index';

const service = (relations: Entity['relations']): Entity =>
  ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'payments' },
    spec: { type: 'service' },
    relations,
  }) as Entity;

describe('hasDependencies', () => {
  it('shows the tab once the service depends on a Resource', () => {
    expect(hasDependencies(service([{ type: 'dependsOn', targetRef: 'resource:default/dev-payments-db' }]))).toBe(true);
  });

  it('hides it without one', () => {
    expect(hasDependencies(service([]))).toBe(false);
    expect(hasDependencies(service([{ type: 'dependsOn', targetRef: 'component:default/auth' }]))).toBe(false);
    expect(hasDependencies(service([{ type: 'ownedBy', targetRef: 'resource:default/x' }]))).toBe(false);
  });
});
