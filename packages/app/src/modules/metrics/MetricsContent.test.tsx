import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    generatedAt: '2026-09-29T12:00:00Z',
    rateWindow: '2m',
    series: {
      stepSeconds: 30,
      points: {
        requestRate: [
          [1790683140, 10],
          [1790683170, 11],
          [1790683200, 12.4],
        ],
        errorRatePercent: [],
        p95LatencySeconds: [],
        cpuUtilizationPercent: [],
        memoryUtilizationPercent: [],
      },
    },
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
      autoDeploy: false,
      argoApplicationName: `payments-${environment}`,
      argoApplicationNamespace: 'argocd',
      syncStatus: 'Synced',
      healthStatus: 'Healthy',
      revision: null,
      lastDeployed: null,
      namespace: environment,
      server: null,
      history: [],
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

const tile = (c: HTMLElement, label: string) => within(c).getByTestId(`metric-${label}`);

// A tile's value as read on screen (number and unit are separate spans).
const valueOf = (c: HTMLElement, label: string) => tile(c, label).children[1].textContent;

// Each tile's presentation state (normal / warning / critical / unknown).
const stateOf = (c: HTMLElement, label: string) => tile(c, label).getAttribute('data-state');

const LABELS = ['Request rate', 'Error rate', 'P95 latency', 'CPU', 'Memory', 'Replicas', 'Restarts 1h'];

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
    await waitFor(() => expect(screen.getByText('Healthy')).toBeInTheDocument());
    const c = card('management');
    expect(valueOf(c, 'Request rate')).toBe('12.4req/s');
    expect(valueOf(c, 'Error rate')).toBe('0%');
    expect(valueOf(c, 'P95 latency')).toBe('42ms');
    expect(valueOf(c, 'CPU')).toBe('18%');
    expect(valueOf(c, 'Memory')).toBe('41%');
    expect(valueOf(c, 'Replicas')).toBe('2 / 2ready');
    expect(valueOf(c, 'Restarts 1h')).toBe('3');
    expect(within(c).getAllByRole('meter')).toHaveLength(2);
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
    await waitFor(() => expect(screen.getByText('Unknown')).toBeInTheDocument());
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument();
    const c = card('management');
    expect(valueOf(c, 'Request rate')).toBe('0req/s');
    for (const label of ['Error rate', 'P95 latency', 'CPU', 'Replicas']) {
      expect(valueOf(c, label)).toBe('—');
    }
    expect(valueOf(c, 'Restarts 1h')).toBe('unavailable');
    expect(within(c).queryAllByRole('meter')).toHaveLength(1);
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
    expect(valueOf(card('management'), 'Request rate')).toBe('12.4req/s');
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

  it('draws a trend with a readable summary and a keyboard tooltip', async () => {
    deploymentsIn('management');
    render({ management: summary('management') });
    await waitFor(() => expect(screen.getByText('Healthy')).toBeInTheDocument());
    const trend = screen.getByRole('slider', { name: /request rate, last 30 minutes/i });
    expect(trend).toHaveAccessibleName(/min 10 req\/s, max 12\.4 req\/s, latest 12\.4 req\/s/i);
    fireEvent.focus(trend);
    expect(within(trend).getByRole('status')).toHaveTextContent('12.4 req/s');
    fireEvent.keyDown(trend, { key: 'ArrowLeft' });
    expect(within(trend).getByRole('status')).toHaveTextContent('11 req/s');
    expect(trend).toHaveAttribute('aria-valuetext', expect.stringContaining('11 req/s'));
    expect(within(card('management')).getAllByText(/no data in the last 30 min/i)).toHaveLength(4);
  });

  it('refreshes every 15 seconds and keeps values on screen', async () => {
    jest.useFakeTimers();
    try {
      deploymentsIn('management');
      const { fetch } = render({ management: summary('management') });
      await waitFor(() => expect(screen.getByText('Healthy')).toBeInTheDocument());
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/live · updated/i)).toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(15_000);
      });
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(valueOf(card('management'), 'Request rate')).toBe('12.4req/s');
    } finally {
      jest.useRealTimers();
    }
  });

  it('explains the health status on hover instead of a footnote', async () => {
    deploymentsIn('management');
    render({ management: summary('management') });
    await waitFor(() => expect(screen.getByText('Healthy')).toBeInTheDocument());
    expect(screen.queryByText(/trends cover the last 30 minutes/i)).not.toBeInTheDocument();
    fireEvent.mouseOver(screen.getByText('Healthy'));
    expect(await screen.findByText('2 of 2 replicas available, 0% 5xx over 2m')).toBeInTheDocument();
    expect(screen.getByText(/trends cover the last 30 minutes/i)).toBeInTheDocument();
  });

  describe('severity', () => {
    const render1 = async (overrides: Partial<ObservabilitySummary>, status: string) => {
      deploymentsIn('management');
      render({ management: summary('management', overrides) });
      await waitFor(() => expect(screen.getByText(status)).toBeInTheDocument());
      return card('management');
    };

    it('healthy: calm card, no tile emphasised', async () => {
      const c = await render1({ errorRatePercent: 0, replicas: { available: 2, desired: 2 }, restarts1h: 0 }, 'Healthy');
      for (const label of LABELS) expect(stateOf(c, label)).toBe('normal');
      expect(within(c).queryByTitle('Critical')).not.toBeInTheDocument();
      expect(within(c).queryByTitle('Warning')).not.toBeInTheDocument();
    });

    it('error rate at 6%: Degraded, error rate critical, replicas normal', async () => {
      const c = await render1({ errorRatePercent: 6, replicas: { available: 2, desired: 2 } }, 'Degraded');
      expect(stateOf(c, 'Error rate')).toBe('critical');
      expect(stateOf(c, 'Replicas')).toBe('normal');
      expect(within(tile(c, 'Error rate')).getByTitle('Critical')).toBeInTheDocument();
      expect(within(tile(c, 'Error rate')).getAllByText('5xx error rate is 6%').length).toBeGreaterThan(0);
    });

    it('1 of 2 replicas: Degraded, replicas critical, error rate normal', async () => {
      const c = await render1({ errorRatePercent: 0, replicas: { available: 1, desired: 2 } }, 'Degraded');
      expect(stateOf(c, 'Replicas')).toBe('critical');
      expect(stateOf(c, 'Error rate')).toBe('normal');
      expect(valueOf(c, 'Replicas')).toBe('1 / 2ready');
    });

    it('restarts: still Healthy, restarts tile warns', async () => {
      const c = await render1({ errorRatePercent: 0, replicas: { available: 2, desired: 2 }, restarts1h: 3 }, 'Healthy');
      expect(stateOf(c, 'Restarts 1h')).toBe('warning');
      expect(within(tile(c, 'Restarts 1h')).getByTitle('Warning')).toBeInTheDocument();
      expect(within(tile(c, 'Restarts 1h')).getAllByText('3 container restarts during the last hour').length).toBeGreaterThan(0);
    });

    it('several problems at once: each tile flagged, one Degraded summary', async () => {
      const c = await render1(
        { errorRatePercent: 8, replicas: { available: 1, desired: 2 }, restarts1h: 4 },
        'Degraded',
      );
      expect(stateOf(c, 'Error rate')).toBe('critical');
      expect(stateOf(c, 'Replicas')).toBe('critical');
      expect(stateOf(c, 'Restarts 1h')).toBe('warning');
      fireEvent.mouseOver(screen.getByText('Degraded'));
      expect(await screen.findByText('Degraded because:')).toBeInTheDocument();
      expect(screen.getByText('1 of 2 replicas available', { selector: 'li' })).toBeInTheDocument();
      expect(screen.getByText('5xx error rate is 8%', { selector: 'li' })).toBeInTheDocument();
    });

    it('missing health data: Unknown, never Healthy', async () => {
      const c = await render1({ replicas: null, unavailable: ['replicasAvailable', 'replicasDesired'] }, 'Unknown');
      expect(screen.queryByText('Healthy')).not.toBeInTheDocument();
      expect(stateOf(c, 'Replicas')).toBe('unknown');
    });

    it('high CPU and memory stay informational', async () => {
      const c = await render1({ cpuUtilizationPercent: 97, memoryUtilizationPercent: 95 }, 'Healthy');
      expect(stateOf(c, 'CPU')).toBe('normal');
      expect(stateOf(c, 'Memory')).toBe('normal');
    });
  });
});
