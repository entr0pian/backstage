import { addDatabaseHref } from './addDatabaseHref';

describe('addDatabaseHref', () => {
  it('forwards the entity name as componentName without requiring manual entry', () => {
    const href = addDatabaseHref('checkout');

    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/create/templates/default/add-database');
    expect(JSON.parse(url.searchParams.get('formData')!)).toEqual({
      componentName: 'checkout',
    });
  });
});
