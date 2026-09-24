import { argoApplicationUrl, joinDeployments } from './joinDeployments';

const noDelivery = {
  argoApplicationName: null,
  argoApplicationNamespace: null,
  syncStatus: 'Unknown',
  healthStatus: 'Unknown',
  revision: null,
  lastDeployed: null,
  namespace: null,
  server: null,
};

describe('joinDeployments', () => {
  it('joins a Release and an Argo Application by environment', () => {
    const result = joinDeployments(
      [{ environment: 'management', version: 'latest', releaseName: 'payments-management' }],
      [
        {
          metadata: {
            name: 'payments-management',
            namespace: 'argocd',
            labels: { 'platform.taskapp.io/environment': 'management' },
          },
          spec: { destination: { namespace: 'management', server: 'https://kubernetes.default.svc' } },
          status: {
            sync: { status: 'Synced', revision: '1078eb1' },
            health: { status: 'Healthy' },
            history: [
              { revision: 'aaaaaaa', deployedAt: '2026-09-24T07:00:00Z' },
              { revision: '1078eb1', deployedAt: '2026-09-24T07:47:00Z' },
            ],
          },
        },
      ],
    );
    expect(result).toEqual([
      {
        environment: 'management',
        version: 'latest',
        releaseName: 'payments-management',
        argoApplicationName: 'payments-management',
        argoApplicationNamespace: 'argocd',
        syncStatus: 'Synced',
        healthStatus: 'Healthy',
        revision: '1078eb1',
        lastDeployed: '2026-09-24T07:47:00Z',
        namespace: 'management',
        server: 'https://kubernetes.default.svc',
      },
    ]);
  });

  it('falls back to operationState.finishedAt when there is no history', () => {
    const [result] = joinDeployments(
      [{ environment: 'dev', version: 'latest', releaseName: 'payments-dev' }],
      [
        {
          metadata: { name: 'payments-dev', labels: { 'platform.taskapp.io/environment': 'dev' } },
          status: { operationState: { finishedAt: '2026-09-24T08:00:00Z' } },
        },
      ],
    );
    expect(result.lastDeployed).toBe('2026-09-24T08:00:00Z');
  });

  it('returns every environment independently for multiple deployments', () => {
    const result = joinDeployments(
      [
        { environment: 'dev', version: 'latest', releaseName: 'payments-dev' },
        { environment: 'prod', version: 'v1.2.3', releaseName: 'payments-prod' },
      ],
      [
        {
          metadata: { labels: { 'platform.taskapp.io/environment': 'dev' } },
          status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } },
        },
        {
          metadata: { labels: { 'platform.taskapp.io/environment': 'prod' } },
          status: { sync: { status: 'OutOfSync' }, health: { status: 'Degraded' } },
        },
      ],
    );
    expect(result.map(d => [d.environment, d.version, d.syncStatus, d.healthStatus])).toEqual([
      ['dev', 'latest', 'Synced', 'Healthy'],
      ['prod', 'v1.2.3', 'OutOfSync', 'Degraded'],
    ]);
  });

  it('surfaces a Release with no matching Argo Application as pending, not dropped', () => {
    const result = joinDeployments(
      [{ environment: 'dev', version: 'latest', releaseName: 'payments-dev' }],
      [],
    );
    expect(result).toEqual([
      { environment: 'dev', version: 'latest', releaseName: 'payments-dev', ...noDelivery },
    ]);
  });

  it('surfaces an Argo Application with no matching Release as version: null, not dropped', () => {
    const [result] = joinDeployments(
      [],
      [
        {
          metadata: { name: 'payments-dev', labels: { 'platform.taskapp.io/environment': 'dev' } },
          status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } },
        },
      ],
    );
    expect(result).toMatchObject({
      environment: 'dev',
      version: null,
      releaseName: null,
      argoApplicationName: 'payments-dev',
      syncStatus: 'Synced',
      healthStatus: 'Healthy',
    });
  });

  it('treats missing sync/health status as Unknown rather than crashing', () => {
    const [result] = joinDeployments(
      [{ environment: 'dev', version: 'latest', releaseName: 'payments-dev' }],
      [{ metadata: { labels: { 'platform.taskapp.io/environment': 'dev' } } }],
    );
    expect(result.syncStatus).toBe('Unknown');
    expect(result.healthStatus).toBe('Unknown');
  });

  it('ignores an Argo Application with no environment label', () => {
    const result = joinDeployments(
      [{ environment: 'dev', version: 'latest', releaseName: 'payments-dev' }],
      [
        {
          metadata: { name: 'unlabelled', labels: {} },
          status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } },
        },
      ],
    );
    expect(result).toEqual([
      { environment: 'dev', version: 'latest', releaseName: 'payments-dev', ...noDelivery },
    ]);
  });

  it('sorts by environment', () => {
    const result = joinDeployments(
      [
        { environment: 'prod', version: '1', releaseName: 'x-prod' },
        { environment: 'dev', version: '1', releaseName: 'x-dev' },
      ],
      [],
    );
    expect(result.map(d => d.environment)).toEqual(['dev', 'prod']);
  });
});

describe('argoApplicationUrl', () => {
  it('builds an Argo CD UI deep link from the configured UI URL', () => {
    expect(
      argoApplicationUrl('https://localhost:9080/', {
        argoApplicationName: 'payments-management',
        argoApplicationNamespace: 'argocd',
      }),
    ).toBe('https://localhost:9080/applications/argocd/payments-management');
  });

  it('returns null without a UI URL or without an Argo Application', () => {
    expect(
      argoApplicationUrl(undefined, { argoApplicationName: 'x', argoApplicationNamespace: 'argocd' }),
    ).toBeNull();
    expect(
      argoApplicationUrl('https://localhost:9080', {
        argoApplicationName: null,
        argoApplicationNamespace: null,
      }),
    ).toBeNull();
  });
});
