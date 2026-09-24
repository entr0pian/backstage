import { sortWorkloadPods, toWorkloadPods, workloadPodSelector } from './workloadPods';

describe('workloadPodSelector', () => {
  it('selects by platform component and environment labels', () => {
    expect(workloadPodSelector('payments', 'management')).toBe(
      'platform.taskapp.io/component=payments,platform.taskapp.io/environment=management',
    );
  });
});

describe('toWorkloadPods', () => {
  it('maps a pod to its cluster, namespace, readiness, restarts and containers', () => {
    const [pod] = toWorkloadPods('management', [
      {
        metadata: { name: 'payments-abc', namespace: 'management', creationTimestamp: '2026-09-24T07:47:00Z' },
        spec: { containers: [{ name: 'payments' }] },
        status: {
          phase: 'Running',
          containerStatuses: [{ name: 'payments', ready: true, restartCount: 2 }],
        },
      },
    ]);
    expect(pod).toEqual({
      clusterName: 'management',
      name: 'payments-abc',
      namespace: 'management',
      phase: 'Running',
      ready: true,
      restarts: 2,
      containers: ['payments'],
      createdAt: '2026-09-24T07:47:00Z',
    });
  });

  it('treats a pod with any unready container, or no statuses yet, as not ready', () => {
    const pods = toWorkloadPods('c', [
      {
        metadata: { name: 'a', namespace: 'n' },
        status: {
          containerStatuses: [
            { name: 'x', ready: true },
            { name: 'y', ready: false },
          ],
        },
      },
      { metadata: { name: 'b', namespace: 'n' }, status: { phase: 'Pending' } },
    ]);
    expect(pods.map(p => p.ready)).toEqual([false, false]);
  });

  it('skips pods without a name or namespace instead of crashing', () => {
    expect(toWorkloadPods('c', [{ metadata: { name: 'a' } }, {}])).toEqual([]);
  });
});

describe('sortWorkloadPods', () => {
  it('puts ready pods first, then the newest', () => {
    const base = { clusterName: 'c', namespace: 'n', phase: 'Running', restarts: 0, containers: ['x'] };
    const sorted = sortWorkloadPods([
      { ...base, name: 'old-ready', ready: true, createdAt: '2026-09-24T07:00:00Z' },
      { ...base, name: 'new-unready', ready: false, createdAt: '2026-09-24T09:00:00Z' },
      { ...base, name: 'new-ready', ready: true, createdAt: '2026-09-24T08:00:00Z' },
    ]);
    expect(sorted.map(p => p.name)).toEqual(['new-ready', 'old-ready', 'new-unready']);
  });
});
