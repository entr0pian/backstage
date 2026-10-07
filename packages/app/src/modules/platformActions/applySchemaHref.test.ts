import { applySchemaHref } from './applySchemaHref';

describe('applySchemaHref', () => {
  it('opens the Apply database schema template with the component filled in', () => {
    const url = new URL(applySchemaHref('orders'), 'http://localhost');
    expect(url.pathname).toBe('/create/templates/default/apply-schema');
    expect(JSON.parse(url.searchParams.get('formData')!)).toEqual({ componentName: 'orders' });
  });

  it('also forwards the environment when given', () => {
    const url = new URL(applySchemaHref('orders', 'dev'), 'http://localhost');
    expect(JSON.parse(url.searchParams.get('formData')!)).toEqual({ componentName: 'orders', environment: 'dev' });
  });
});
