import { screen, waitFor } from '@testing-library/react';
import { mockApis, renderInTestApp } from '@backstage/frontend-test-utils';
import {
  EntityProvider,
  starredEntitiesApiRef,
  type StarredEntitiesApi,
} from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import { ServiceHeader } from './ServiceHeader';
import { useDeployments } from '../deployments/useDeployments';
import { useObservabilitySummary } from '../metrics/useObservabilitySummary';

jest.mock('../deployments/useDeployments');
jest.mock('../metrics/useObservabilitySummary');

const payments: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'payments',
    description: 'payments service',
    annotations: { 'github.com/project-slug': 'entr0pian/payments' },
  },
  spec: { type: 'service', owner: 'payments-team', lifecycle: 'experimental' },
};

// Minimal StarredEntitiesApi for the favourite star: nothing starred.
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

const tabs = [
  { id: 'overview', label: 'Overview', href: '/catalog/default/component/payments' },
  { id: 'deployments', label: 'Deployments', href: '/catalog/default/component/payments/deployments' },
  { id: 'metrics', label: 'Metrics', href: '/catalog/default/component/payments/metrics' },
];

beforeEach(() => {
  (useDeployments as jest.Mock).mockReturnValue({
    status: 'done',
    deployments: [
      {
        environment: 'management',
        version: '9bfb8b8a5dcb189cf4acb6227c59f905bbb4086f',
        releaseName: 'payments-management',
        argoApplicationName: 'payments-management',
        argoApplicationNamespace: 'argocd',
        syncStatus: 'Synced',
        healthStatus: 'Healthy',
        revision: null,
        lastDeployed: null,
        namespace: 'management',
        server: null,
        history: [],
      },
    ],
  });
  (useObservabilitySummary as jest.Mock).mockReturnValue({
    summary: {
      component: 'payments',
      environment: 'management',
      generatedAt: '2026-09-29T12:00:00Z',
      rateWindow: '2m',
      requestRate: 1,
      errorRatePercent: 0,
      p95LatencySeconds: 0.005,
      cpuUtilizationPercent: 1,
      memoryUtilizationPercent: 5,
      replicas: { available: 0, desired: 1 },
      restarts1h: 0,
      unavailable: [],
      series: { stepSeconds: 30, points: {} },
    },
    error: null,
    updatedAt: 0,
    loading: false,
  });
});

describe('ServiceHeader', () => {
  it('shows identity, live environment health, version and quick links', async () => {
    await renderInTestApp(
      <EntityProvider entity={payments}>
        <ServiceHeader tabs={tabs} activeTabId="metrics" />
      </EntityProvider>,
      {
        apis: [mockApis.fetch(), mockApis.discovery(), [starredEntitiesApiRef, starred]],
        config: {
          platform: {
            grafanaUiUrl: 'https://grafana.example.dev',
            argocdUiUrl: 'https://argocd.example.dev',
          },
        },
      },
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: 'payments' })).toBeInTheDocument());
    expect(screen.getByText(/payments service · owned by payments-team · experimental/)).toBeInTheDocument();
    // Same rules as the Metrics tab: 0 of 1 replicas is Degraded.
    expect(screen.getByRole('link', { name: 'management: Degraded' })).toHaveAttribute(
      'href',
      '/catalog/default/component/payments/metrics',
    );
    expect(screen.getByText('· 9bfb8b8')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /repository/i })).toHaveAttribute(
      'href',
      'https://github.com/entr0pian/payments',
    );
    expect(screen.getByRole('link', { name: /grafana/i }).getAttribute('href')).toContain(
      'var-component=payments&var-environment=management',
    );
    expect(screen.getByRole('link', { name: /argo cd/i })).toHaveAttribute(
      'href',
      'https://argocd.example.dev/applications/argocd/payments-management',
    );
  });

  it('shows each environment with its own version, and links that span them', async () => {
    const management = (useDeployments as jest.Mock)().deployments[0];
    (useDeployments as jest.Mock).mockReturnValue({
      status: 'done',
      deployments: [
        management,
        {
          ...management,
          environment: 'dev',
          version: 'abcdef1234567890abcdef1234567890abcdef12',
          releaseName: 'payments-dev',
          argoApplicationName: 'payments-dev',
        },
      ],
    });
    await renderInTestApp(
      <EntityProvider entity={payments}>
        <ServiceHeader tabs={tabs} activeTabId="metrics" />
      </EntityProvider>,
      {
        apis: [mockApis.fetch(), mockApis.discovery(), [starredEntitiesApiRef, starred]],
        config: {
          platform: {
            grafanaUiUrl: 'https://grafana.example.dev',
            argocdUiUrl: 'https://argocd.example.dev',
          },
        },
      },
    );
    await waitFor(() => expect(screen.getByRole('link', { name: /^dev:/ })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /^management:/ })).toHaveTextContent('9bfb8b8');
    expect(screen.getByRole('link', { name: /^dev:/ })).toHaveTextContent('abcdef1');
    const grafana = screen.getByRole('link', { name: /grafana/i }).getAttribute('href');
    expect(grafana).toContain('var-component=payments');
    expect(grafana).not.toContain('var-environment');
    expect(screen.getByRole('link', { name: /argo cd/i }).getAttribute('href')).toBe(
      `https://argocd.example.dev/applications?labels=${encodeURIComponent(
        'platform.taskapp.io/component=payments,platform.taskapp.io/type=service',
      )}`,
    );
  });

  it('renders the tab row with the active tab marked', async () => {
    await renderInTestApp(
      <EntityProvider entity={payments}>
        <ServiceHeader tabs={tabs} activeTabId="metrics" />
      </EntityProvider>,
      { apis: [mockApis.fetch(), mockApis.discovery(), [starredEntitiesApiRef, starred]] },
    );
    const nav = await screen.findByRole('navigation', { name: 'Service sections' });
    expect(nav).toHaveTextContent('OverviewDeploymentsMetrics');
    expect(screen.getByRole('link', { name: 'Metrics' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });
});
