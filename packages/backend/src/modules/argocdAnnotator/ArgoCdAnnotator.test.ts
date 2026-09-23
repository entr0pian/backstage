import { ArgoCdAnnotator, argoCdAppSelectorFor } from './ArgoCdAnnotator';
import type { Entity } from '@backstage/catalog-model';

function componentEntity(name: string, extra?: Partial<Entity>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name },
    spec: { type: 'service' },
    ...extra,
  } as Entity;
}

describe('argoCdAppSelectorFor', () => {
  it('derives the selector from the component name alone', () => {
    expect(argoCdAppSelectorFor('payments')).toBe(
      'platform.taskapp.io/component=payments,platform.taskapp.io/type=service',
    );
  });
});

describe('ArgoCdAnnotator', () => {
  const annotator = new ArgoCdAnnotator();
  const noop = jest.fn();
  const location = { type: 'url', target: 'https://example.com' };

  it('stamps argocd/app-selector onto a Component entity', async () => {
    const result = await annotator.preProcessEntity(
      componentEntity('payments'),
      location,
      noop,
      location,
      undefined as never,
    );
    expect(result.metadata.annotations?.['argocd/app-selector']).toBe(
      'platform.taskapp.io/component=payments,platform.taskapp.io/type=service',
    );
  });

  it('leaves non-Component entities unchanged', async () => {
    const resource: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: { name: 'dev-payments-db' },
      spec: { type: 'database' },
    };
    const result = await annotator.preProcessEntity(
      resource,
      location,
      noop,
      location,
      undefined as never,
    );
    expect(result).toBe(resource);
  });

  it('preserves existing annotations rather than replacing the whole map', async () => {
    const entity = componentEntity('payments', {
      metadata: {
        name: 'payments',
        annotations: { 'github.com/project-slug': 'entr0pian/payments' },
      },
    });
    const result = await annotator.preProcessEntity(
      entity,
      location,
      noop,
      location,
      undefined as never,
    );
    expect(result.metadata.annotations).toEqual({
      'github.com/project-slug': 'entr0pian/payments',
      'argocd/app-selector':
        'platform.taskapp.io/component=payments,platform.taskapp.io/type=service',
    });
  });

  it('is idempotent — re-running always derives the same value', async () => {
    const once = await annotator.preProcessEntity(
      componentEntity('payments'),
      location,
      noop,
      location,
      undefined as never,
    );
    const twice = await annotator.preProcessEntity(
      once,
      location,
      noop,
      location,
      undefined as never,
    );
    expect(twice.metadata.annotations?.['argocd/app-selector']).toBe(
      once.metadata.annotations?.['argocd/app-selector'],
    );
  });

  it('derives a different selector per component, never a shared/default one', async () => {
    const a = await annotator.preProcessEntity(
      componentEntity('payments'),
      location,
      noop,
      location,
      undefined as never,
    );
    const b = await annotator.preProcessEntity(
      componentEntity('checkout'),
      location,
      noop,
      location,
      undefined as never,
    );
    expect(a.metadata.annotations?.['argocd/app-selector']).not.toBe(
      b.metadata.annotations?.['argocd/app-selector'],
    );
  });
});
