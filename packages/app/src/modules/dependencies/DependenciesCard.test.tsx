import { fireEvent, screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { EntityProvider, entityRouteRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { DependenciesCard } from './DependenciesCard';
import { DependencyList } from './DependencyList';
import { useDependencies } from './useDependencies';
import { groupByEnvironment } from './groupByEnvironment';

const navigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => navigate,
}));
jest.mock('./useDependencies');
jest.mock('../databases/useDatabaseDetails', () => ({
  useDatabaseDetails: () => ({
    status: 'done',
    details: {
      ready: true,
      problem: null,
      spec: { dbName: 'payments', size: 'small' },
      engine: { engine: 'postgres', version: '16.13' },
      boundBy: [],
    },
  }),
}));
const SHA = '54f3f80a9a9e8b3dfe78bd95fad3cd0a0f6d14e4';
jest.mock('../deployments/useSchemaStatus', () => ({
  useSchemaStatus: () => ({
    requested: { name: 'payments', namespace: 'dev', version: SHA, database: 'payments-db', published: true, reason: null },
    applied: {
      name: 'payments-schema',
      namespace: 'dev',
      commit: SHA,
      phase: 'Applied',
      lastAppliedVersion: '20261007000000',
      appliedAt: null,
      reason: null,
    },
    code: null,
    latest: { version: SHA, createdAt: null },
  }),
}));

const payments = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'payments', namespace: 'default' },
  spec: { type: 'service', owner: 'payments-team', lifecycle: 'experimental' },
} as Entity;

const database = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Resource',
  metadata: {
    name: 'dev-payments-db',
    title: 'payments-db',
    namespace: 'default',
    annotations: {
      'platform.taskapp.io/environment': 'dev',
      'platform.taskapp.io/kubernetes-namespace': 'dev',
      'platform.taskapp.io/database-name': 'payments-db',
    },
  },
  spec: { type: 'database' },
} as Entity;

const render = (ui: JSX.Element) =>
  renderInTestApp(<EntityProvider entity={payments}>{ui}</EntityProvider>, {
    mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef },
  });

describe('DependenciesCard', () => {
  beforeEach(() => {
    navigate.mockReset();
    (useDependencies as jest.Mock).mockReturnValue({
      status: 'done',
      environments: groupByEnvironment([database], ['dev']),
    });
  });

  it('lays a database out like a deployment row: status, schema and binding columns', async () => {
    await render(<DependenciesCard />);
    for (const column of ['Environment', 'Dependency', 'Status', 'Schema', 'Binding']) {
      expect(await screen.findByText(column)).toBeInTheDocument();
    }
    expect(screen.getByText('payments-db')).toBeInTheDocument();
    expect(screen.getByText('postgres 16.13 · small')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Up to date')).toBeInTheDocument();
    expect(screen.getByText('Not bound')).toBeInTheDocument();
  });

  it("opens the database's page from anywhere on the row", async () => {
    await render(<DependenciesCard />);
    fireEvent.click(await screen.findByText('Up to date'));
    expect(navigate).toHaveBeenCalledWith('/catalog/default/resource/dev-payments-db');
  });
});

describe('DependencyList', () => {
  it("makes the whole row one link to the database's page", async () => {
    const [{ groups }] = groupByEnvironment([database], ['dev']);
    await render(<DependencyList groups={groups} />);
    const row = (await screen.findByText('Schema up to date')).closest('a');
    expect(row?.getAttribute('href')).toBe('/catalog/default/resource/dev-payments-db');
    expect(row).toContainElement(screen.getByText('payments-db'));
  });
});
