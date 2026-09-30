import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { usePermission } from '@backstage/plugin-permission-react';
import { EntityProvider, entityRouteRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { DependenciesContent } from './DependenciesContent';
import { useDependencies } from './useDependencies';
import { groupByEnvironment } from './groupByEnvironment';

jest.mock('./useDependencies');
// Mocked rather than faked through the permission API: usePermission caches
// results by permission across renders, so one test's answer leaks into the
// next.
jest.mock('@backstage/plugin-permission-react', () => ({
  ...jest.requireActual('@backstage/plugin-permission-react'),
  usePermission: jest.fn(),
}));
jest.mock('../databases/useDatabaseDetails', () => ({
  useDatabaseDetails: () => ({ status: 'loading' }),
}));

const payments = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'payments', namespace: 'default' },
  spec: { type: 'service', owner: 'payments-team', lifecycle: 'experimental' },
} as Entity;

const database = (environment: string): Entity =>
  ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: `${environment}-payments-db`,
      title: 'payments-db',
      namespace: 'default',
      annotations: {
        'platform.taskapp.io/environment': environment,
        'platform.taskapp.io/kubernetes-namespace': environment,
        'platform.taskapp.io/database-name': 'payments-db',
      },
    },
    spec: { type: 'database' },
  }) as Entity;

const render = (result: 'ALLOW' | 'DENY') => {
  (usePermission as jest.Mock).mockReturnValue({ loading: false, allowed: result === 'ALLOW' });
  return renderInTestApp(
    <EntityProvider entity={payments}>
      <DependenciesContent />
    </EntityProvider>,
    {
      mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef },
    },
  );
};

describe('DependenciesContent', () => {
  beforeEach(() => {
    (useDependencies as jest.Mock).mockReturnValue({
      status: 'done',
      environments: groupByEnvironment([database('dev')], ['management', 'dev']),
    });
  });

  it('gives each environment with dependencies its own card', async () => {
    await render('ALLOW');
    expect(await screen.findByText('1 dependency')).toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getAllByText('payments-db')).toHaveLength(1);
  });

  it('offers the owner to add a database in the card and in each empty environment', async () => {
    await render('ALLOW');
    const hrefs = (await screen.findAllByText(/add (a )?database/i)).map(label =>
      decodeURIComponent(label.closest('a')?.getAttribute('href') ?? ''),
    );
    expect(hrefs).toEqual([
      '/create/templates/default/add-database?formData={"componentName":"payments","environment":"dev"}',
      '/create/templates/default/add-database?formData={"componentName":"payments","environment":"management"}',
    ]);
  });

  it('shows guests only what exists', async () => {
    await render('DENY');
    await screen.findByText('1 dependency');
    expect(screen.queryByText(/add (a )?database/i)).not.toBeInTheDocument();
    expect(screen.queryByText('management')).not.toBeInTheDocument();
  });
});
