import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import type { SchemaStatus } from '../deployments/useSchemaStatus';
import { DatabaseSchemaCard } from './DatabaseSchemaCard';

const useArgoApplication = jest.fn();
jest.mock('../platformUi/argocd', () => ({
  ...jest.requireActual('../platformUi/argocd'),
  useArgocdUiUrl: () => 'https://argocd.example.dev',
  useArgoApplication: (selector: unknown) => useArgoApplication(selector),
}));

const SHA = '54f3f80a9a9e8b3dfe78bd95fad3cd0a0f6d14e4';

const schema: SchemaStatus = {
  requested: { name: 'payments', namespace: 'dev', version: SHA, database: 'payments-db', published: true, reason: 'Published' },
  applied: {
    name: 'payments-schema',
    namespace: 'dev',
    commit: SHA,
    phase: 'Applied',
    lastAppliedVersion: '20261007000000',
    appliedAt: null,
    reason: 'Applied',
  },
  code: null,
  latest: { version: SHA, createdAt: null },
};

const render = (canApply: boolean) =>
  renderInTestApp(
    <DatabaseSchemaCard component="payments" environment="dev" database="payments-db" schema={schema} canApply={canApply} />,
  );

describe('DatabaseSchemaCard', () => {
  beforeEach(() => useArgoApplication.mockReturnValue(null));

  it('lists each check with its state and the states it can be in', async () => {
    await render(false);
    expect(await screen.findByText('Checked and applied')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('Can be: Applied · Migrating · Pending · Failed · Nothing applied')).toBeInTheDocument();
  });

  it('offers owners, not guests, to apply a schema here', async () => {
    await render(false);
    await screen.findByText('Checked and applied');
    expect(screen.queryByText('Apply database schema')).not.toBeInTheDocument();

    await render(true);
    const link = (await screen.findByText('Apply database schema')).closest('a');
    expect(decodeURIComponent(link?.getAttribute('href') ?? '')).toBe(
      '/create/templates/default/apply-schema?formData={"componentName":"payments","environment":"dev"}',
    );
  });

  it("opens the schema's own Argo CD Application, for guests too", async () => {
    useArgoApplication.mockReturnValue({ name: 'payments-schema-dev' });
    await render(false);
    const link = (await screen.findByText('Open in Argo CD')).closest('a');
    expect(link?.getAttribute('href')).toBe('https://argocd.example.dev/applications/argocd/payments-schema-dev');
    expect(useArgoApplication).toHaveBeenCalledWith({ type: 'schema', component: 'payments', environment: 'dev' });
  });
});
