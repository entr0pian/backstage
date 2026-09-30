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

  it('gives each environment its own card, empty ones included', async () => {
    await render('ALLOW');
    expect(await screen.findByText('1 dependency in dev')).toBeInTheDocument();
    expect(screen.getByText('No dependencies in management')).toBeInTheDocument();
    expect(screen.getByText('This service uses no platform infrastructure in management.')).toBeInTheDocument();
    expect(screen.getAllByText('payments-db')).toHaveLength(1);
  });

  it('offers Add database per environment to the owner only', async () => {
    await render('ALLOW');
    const links = (await screen.findAllByText('Add database')).map(label => label.closest('a')!);
    expect(links.map(l => decodeURIComponent(l.getAttribute('href') ?? ''))).toEqual([
      '/create/templates/default/add-database?formData={"componentName":"payments","environment":"management"}',
      '/create/templates/default/add-database?formData={"componentName":"payments","environment":"dev"}',
    ]);
  });

  it('hides Add database from guests', async () => {
    await render('DENY');
    await screen.findByText('1 dependency in dev');
    expect(screen.queryByText('Add database')).not.toBeInTheDocument();
  });
});
