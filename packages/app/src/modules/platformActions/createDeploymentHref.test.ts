import { createDeploymentHref } from './createDeploymentHref';

describe('createDeploymentHref', () => {
  it('opens the create-deployment template with the component pre-filled', () => {
    const url = new URL(createDeploymentHref('checkout'), 'http://localhost');
    expect(url.pathname).toBe('/create/templates/default/create-deployment');
    expect(JSON.parse(url.searchParams.get('formData')!)).toEqual({
      componentName: 'checkout',
    });
  });

  it('pre-fills a roll back: environment, version and current bindings', () => {
    const url = new URL(
      createDeploymentHref('payments', {
        environment: 'dev',
        version: 'e692041c498a0d4ee4efad2563667d87af3d1fbc',
        bindings: { database: 'payments-db' },
      }),
      'http://localhost',
    );
    expect(JSON.parse(url.searchParams.get('formData')!)).toEqual({
      componentName: 'payments',
      environment: 'dev',
      version: 'e692041c498a0d4ee4efad2563667d87af3d1fbc',
      bindings: { database: 'payments-db' },
    });
  });
});
