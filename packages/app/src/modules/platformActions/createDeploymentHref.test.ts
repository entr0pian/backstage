import { createDeploymentHref } from './createDeploymentHref';

describe('createDeploymentHref', () => {
  it('opens the create-deployment template with the component pre-filled', () => {
    const url = new URL(createDeploymentHref('checkout'), 'http://localhost');
    expect(url.pathname).toBe('/create/templates/default/create-deployment');
    expect(JSON.parse(url.searchParams.get('formData')!)).toEqual({
      componentName: 'checkout',
    });
  });
});
