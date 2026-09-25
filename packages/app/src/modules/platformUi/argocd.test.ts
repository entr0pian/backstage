import { argoApplicationUrl, platformSelector } from './argocd';

describe('platformSelector', () => {
  it('builds the same label selector every platform view queries Argo CD with', () => {
    expect(platformSelector({ component: 'payments', type: 'service' })).toBe(
      'platform.taskapp.io/component=payments,platform.taskapp.io/type=service',
    );
    expect(platformSelector({ type: 'database', environment: 'management', name: 'payments-db' })).toBe(
      'platform.taskapp.io/environment=management,platform.taskapp.io/type=database,platform.taskapp.io/name=payments-db',
    );
  });
});

describe('argoApplicationUrl', () => {
  it('builds an Argo CD UI deep link from the configured UI URL', () => {
    expect(
      argoApplicationUrl('https://argocd.gerodimos.dev/', {
        name: 'payments-management',
        namespace: 'argocd',
      }),
    ).toBe('https://argocd.gerodimos.dev/applications/argocd/payments-management');
  });

  it("defaults to Argo CD's own namespace", () => {
    expect(argoApplicationUrl('https://argocd.gerodimos.dev', { name: 'payments-db-management' })).toBe(
      'https://argocd.gerodimos.dev/applications/argocd/payments-db-management',
    );
  });

  it('returns null without a UI URL or without an Argo Application', () => {
    expect(argoApplicationUrl(undefined, { name: 'x', namespace: 'argocd' })).toBeNull();
    expect(argoApplicationUrl('https://argocd.gerodimos.dev', { name: null, namespace: null })).toBeNull();
  });
});
