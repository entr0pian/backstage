import { screen, waitFor, within } from '@testing-library/react';
import {
  createExtensionTester,
  mockApis,
  renderInTestApp,
} from '@backstage/frontend-test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';
import { MetricsContent } from './MetricsContent';
import { metricsContent } from './index';
import { useDeployments } from '../deployments/useDeployments';
import type { ObservabilitySummary } from './summary';

jest.mock('../deployments/useDeployments');
const mockUseDeployments = useDeployments as jest.MockedFunction<typeof useDeployments>;

const payments: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'payments' },
  spec: { type: 'service', owner: 'entr0pian', lifecycle: 'production' },
};

function summary(environment: string, overrides: Partial<ObservabilitySummary> = {}): ObservabilitySummary {
  return {
    component: 'payments',
    environment,
    requestRate: 12.4,
    errorRatePercent: 0,
    p95LatencySeconds: 0.042,
    cpuUtilizationPercent: 18,
    memoryUtilizationPercent: 41,
    replicas: { available: 2, desired: 2 },
    restarts1h: 0,
    unavailable: [],
    ...overrides,
  };
}

function deploymentsIn(...environments: string[]) {
  mockUseDeployments.mockReturnValue({
    status: 'done',
    deployments: environments.map(environment => ({
      environment,
      version: 'v1',
      releaseName: `payments-${environment}`,
      argoApplicationName: `payments-${environment}`,
      argoApplicationNamespace: 'argocd',
      syncStatus: 'Synced',
      healthStatus: 'Healthy',
      revision: null,
      lastDeployed: null,
      namespace: environment,
      server: null,
    })),
  });
}

// Backend responses by environment; an Error makes that environment's
// request answer 503.
function render(responses: Record<string, ObservabilitySummary | Error>) {
  const fetch = jest.fn(async (url: string) => {
    const environment = decodeURIComponent(url.split('/environments/')[1]);
    const body = responses[environment];
    if (body instanceof Error) {
      return new Response(JSON.stringify({ error: body.message }), { status: 503 });
    }
    return new Response(JSON.stringify(body), { status: 200 });
  });
  const result = renderInTestApp(
    <EntityProvider entity={payments}>
      <MetricsContent />
    </EntityProvider>,
    {
      apis: [
        mockApis.fetch.mock({ fetch: fetch as unknown as typeof globalThis.fetch }),
        mockApis.discovery({ baseUrl: 'http://backstage' }),
      ],
      config: { platform: { grafanaUiUrl: 'https://grafana.example.dev/' } },
    },
  );
  return { fetch, ...result };
}

const card = (environment: string) =>
  screen.getByText(environment).closest('.MuiCard-root') as HTMLElement;

describe('Metrics tab', () => {
  it('is a Metrics tab in the observability group, for service Components only', () => {
    const tester = createExtensionTester(metricsContent);
    expect(tester.get(EntityContentBlueprint.dataRefs.title)).toBe('Metrics');
    expect(tester.get(EntityContentBlueprint.dataRefs.group)).toBe('observability');
    const filter = tester.get(EntityContentBlueprint.dataRefs.filterFunction)!;
    expect(filter(payments)).toBe(true);
    expect(filter({ ...payments, kind: 'Resource' })).toBe(false);
    expect(filter({ ...payments, spec: { type: 'website' } })).toBe(false);
  });

  it('renders one card per deployed environment, fetching only component + environment', async () => {
    deploymentsIn('dev', 'management');
    const { fetch } = render({ dev: summary('dev'), management: summary('management') });
    await waitFor(() => expect(screen.getAllByText('Healthy')).toHaveLength(2));
    expect(card('dev')).toBeInTheDocument();
    expect(card('management')).toBeInTheDocument();
    expect(fetch.mock.calls.map(([url]) => url).sort()).toEqual([
      'http://backstage/api/platform/observability/components/payments/environments/dev',
      'http://backstage/api/platform/observability/components/payments/environments/management',
    ]);
  });

  it('renders the golden signals from the backend response', async () => {
    deploymentsIn('management');
    render({ management: summary('management', { restarts1h: 3 }) });
    const c = await waitFor(() => within(card('management')).getByText('12.4 req/s') && card('management'));
    for (const text of ['0%', '42 ms', '18%', '41%', '2 / 2', '3']) {
      expect(within(c).getByText(text)).toBeInTheDocument();
    }
  });

  it('shows missing metrics as no data, not zero', async () => {
    deploymentsIn('management');
    render({
      management: summary('management', {
        requestRate: 0,
        errorRatePercent: null,
        p95LatencySeconds: null,
        cpuUtilizationPercent: null,
        replicas: null,
        unavailable: ['restarts1h'],
      }),
    });
    await waitFor(() => expect(screen.getByText('No data')).toBeInTheDocument());
    const c = card('management');
    expect(within(c).getByText('0 req/s')).toBeInTheDocument();
    expect(within(c).getAllByText('—')).toHaveLength(4);
    expect(within(c).getByText('unavailable')).toBeInTheDocument();
  });

  it('flags a replica shortfall as Degraded', async () => {
    deploymentsIn('management');
    render({ management: summary('management', { replicas: { available: 1, desired: 2 } }) });
    await waitFor(() => expect(screen.getByText('Degraded')).toBeInTheDocument());
  });

  it('keeps other environments when one fails', async () => {
    deploymentsIn('dev', 'management');
    render({ dev: new Error('Metrics are unavailable right now'), management: summary('management') });
    await waitFor(() => expect(screen.getByText('Healthy')).toBeInTheDocument());
    expect(within(card('dev')).getByText('Metrics are unavailable right now')).toBeInTheDocument();
    expect(within(card('management')).getByText('12.4 req/s')).toBeInTheDocument();
  });

  it('links each card to Service Overview with its component and environment', async () => {
    deploymentsIn('dev', 'management');
    render({ dev: summary('dev'), management: summary('management') });
    await waitFor(() => expect(screen.getAllByText('Healthy')).toHaveLength(2));
    for (const environment of ['dev', 'management']) {
      const link = within(card(environment)).getByRole('link', { name: /open in grafana/i });
      const url = new URL(link.getAttribute('href')!);
      expect(url.origin + url.pathname).toBe('https://grafana.example.dev/d/platform-service-overview');
      expect(url.searchParams.get('var-component')).toBe('payments');
      expect(url.searchParams.get('var-environment')).toBe(environment);
    }
  });
});
