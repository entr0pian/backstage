import { screen, waitFor, within } from '@testing-library/react';
import { mockApis, renderInTestApp } from '@backstage/frontend-test-utils';
import {
  EntityKindPicker,
  catalogApiRef,
  starredEntitiesApiRef,
  type StarredEntitiesApi,
} from '@backstage/plugin-catalog-react';
import { usePermission } from '@backstage/plugin-permission-react';
import type { Entity } from '@backstage/catalog-model';
import { CatalogPage } from './CatalogPage';

jest.mock('@backstage/plugin-permission-react', () => ({
  ...jest.requireActual('@backstage/plugin-permission-react'),
  usePermission: jest.fn(),
}));
// Service cards poll live health; not under test here.
jest.mock('../deployments/useDeployments', () => ({
  useDeployments: () => ({ status: 'done', deployments: [] }),
}));

const entities: Entity[] = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'payments', namespace: 'default', uid: '1', description: 'payments service' },
    spec: { type: 'service', lifecycle: 'experimental', owner: 'group:default/payments-team' },
  },
];

const catalogApi = {
  getEntities: jest.fn(async () => ({ items: entities })),
  queryEntities: jest.fn(async () => ({ items: entities, totalItems: entities.length, pageInfo: {} })),
  getEntitiesByRefs: jest.fn(async () => ({ items: [] })),
  getEntityFacets: jest.fn(async () => ({
    facets: {
      kind: [
        { value: 'Component', count: 1 },
        { value: 'Resource', count: 1 },
        { value: 'Template', count: 3 },
        { value: 'Location', count: 2 },
      ],
    },
  })),
};

const starred = {
  toggleStarred: async () => {},
  starredEntitie$: () => ({
    subscribe: (observer: ((v: Set<string>) => void) | { next?: (v: Set<string>) => void }) => {
      const next = typeof observer === 'function' ? observer : observer.next;
      next?.(new Set());
      return { unsubscribe: () => {}, closed: false };
    },
  }),
} as unknown as StarredEntitiesApi;

const render = (isOwner: boolean, view?: 'table') => {
  (usePermission as jest.Mock).mockReturnValue({ loading: false, allowed: isOwner });
  try {
    localStorage.clear();
    if (view) localStorage.setItem('platform.catalog.view', view);
  } catch {
    // ignore
  }
  // The stock kind filter: the list only loads once a kind filter exists,
  // exactly as on the real page.
  const filters = [<EntityKindPicker key="kind" initialFilter="component" />];
  return renderInTestApp(<CatalogPage filters={filters} />, {
    initialRouteEntries: ['/catalog'],
    apis: [
      [catalogApiRef, catalogApi],
      [starredEntitiesApiRef, starred],
      mockApis.identity({ userEntityRef: 'user:default/guest' }),
    ],
  });
};

describe('CatalogPage', () => {
  it('shows per-kind counts in the header, without Locations', async () => {
    await render(false);
    expect(await screen.findByRole('button', { name: /Template\s*3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Component\s*1/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Location/ })).not.toBeInTheDocument();
  });

  it('renders entities as cards by default', async () => {
    await render(false);
    const link = await screen.findByRole('link', { name: 'payments' });
    expect(link).toHaveAttribute('href', '/catalog/default/component/payments');
    const card = link.closest('[class*="makeStyles-card-"]') as HTMLElement;
    expect(within(card).getByText('payments service')).toBeInTheDocument();
    expect(within(card).getByText('owner: payments-team')).toBeInTheDocument();
  });

  it('remembers the table view, without System/Tags columns', async () => {
    await render(false, 'table');
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'true');
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers.join(' ')).toMatch(/Name/);
    expect(headers.join(' ')).not.toMatch(/System|Tags/);
  });

  it('hides Owned and Create from guests', async () => {
    await render(false);
    await screen.findByRole('link', { name: 'payments' });
    expect(screen.queryByText('Owned')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });

  it('shows Create to the owner', async () => {
    await render(true);
    expect(await screen.findByRole('button', { name: 'Create' })).toBeInTheDocument();
  });
});
