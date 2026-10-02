import {
  buildEnvironmentSummary,
  imageTag,
  type EnvironmentObjects,
} from './EnvironmentSummary';

const NOW = new Date('2026-09-24T11:00:00Z');
const SHA = 'd82b3e9e1f8fcff59fd0307bec8a845df8fd7332';

function paymentsObjects(overrides: Partial<EnvironmentObjects> = {}): EnvironmentObjects {
  return {
    release: {
      name: 'payments-management',
      namespace: 'management',
      version: SHA,
      bindings: { database: { enabled: true, ref: 'payments-db' } },
      ready: { type: 'Ready', status: 'True', reason: 'Synced' },
    },
    deployments: [
      {
        metadata: { name: 'payments', namespace: 'management', generation: 1 },
        spec: { replicas: 1 },
        status: {
          observedGeneration: 1,
          readyReplicas: 1,
          availableReplicas: 1,
          conditions: [
            { type: 'Progressing', status: 'True', reason: 'NewReplicaSetAvailable', lastUpdateTime: new Date('2026-09-24T10:14:30Z') },
          ],
        },
      },
    ],
    cluster: { name: 'management', reachable: true },
    replicaSets: [
      {
        metadata: {
          name: 'payments-568c859586',
          namespace: 'management',
          annotations: { 'deployment.kubernetes.io/revision': '1' },
          ownerReferences: [{ kind: 'Deployment', name: 'payments' }],
        },
        spec: { replicas: 1, template: { spec: { containers: [{ image: `ghcr.io/entr0pian/payments:${SHA}` }] } } },
        status: { replicas: 1, readyReplicas: 1, availableReplicas: 1 },
      },
    ],
    pods: [
      {
        metadata: {
          name: 'payments-568c859586-49zbz',
          namespace: 'management',
          creationTimestamp: '2026-09-24T10:14:00Z',
          ownerReferences: [{ kind: 'ReplicaSet', name: 'payments-568c859586' }],
        },
        spec: { containers: [{ name: 'payments', image: `ghcr.io/entr0pian/payments:${SHA}` }] },
        status: {
          phase: 'Running',
          containerStatuses: [{ name: 'payments', ready: true, restartCount: 0, state: {} }],
        },
      },
    ],
    services: [
      {
        metadata: { name: 'payments', namespace: 'management' },
        spec: { ports: [{ name: 'http', port: 8080, protocol: 'TCP' }] },
      },
    ],
    endpointSlices: {
      'management/payments': [{ endpoints: [{ conditions: { ready: true } }] }],
    },
    externalSecrets: [
      {
        metadata: {
          name: 'payments-binding-database',
          namespace: 'management',
          labels: { 'platform.taskapp.io/binding': 'database' },
        },
        spec: { dataFrom: [{ extract: { key: '/bindings/management/databases/payments-db' } }] },
        status: {
          refreshTime: '2026-09-24T09:47:58Z',
          conditions: [{ type: 'Ready', status: 'True', reason: 'SecretSynced', message: 'secret synced' }],
        },
      },
    ],
    events: [],
    ...overrides,
  };
}

describe('imageTag', () => {
  it('extracts the tag, ignoring registry ports and digests', () => {
    expect(imageTag('ghcr.io/entr0pian/payments:abc')).toBe('abc');
    expect(imageTag('localhost:5000/payments:v1')).toBe('v1');
    expect(imageTag('localhost:5000/payments')).toBe('latest');
    expect(imageTag('ghcr.io/x/y:v2@sha256:deadbeef')).toBe('v2');
  });
});

describe('buildEnvironmentSummary', () => {
  it('summarises a healthy payments/management environment', () => {
    const s = buildEnvironmentSummary('payments', 'management', paymentsObjects(), {
      includeSensitive: false,
      now: NOW,
    });
    expect(s.release).toEqual({
      name: 'payments-management',
      namespace: 'management',
      version: SHA,
      ready: true,
      reason: 'Synced',
    });
    expect(s.workload.desiredReplicas).toBe(1);
    expect(s.workload.readyReplicas).toBe(1);
    expect(s.workload.pods[0]).toMatchObject({ ready: true, restarts: 0, problem: null });
    expect(s.workload.imageMatchesRelease).toBe(true);
    expect(s.workload.pods[0].replicaSet).toBe('payments-568c859586');
    expect(s.workload.replicaSets).toEqual([
      expect.objectContaining({ name: 'payments-568c859586', revision: 1, version: SHA, desired: 1, ready: 1 }),
    ]);
    expect(s.cluster).toEqual({ name: 'management', reachable: true });
    expect(s.progress).toMatchObject({
      phase: 'Healthy',
      targetVersion: SHA,
      desiredReplicas: 1,
      startedAt: '2026-09-24T10:14:00Z',
      completedAt: '2026-09-24T10:14:30.000Z',
    });
    expect(s.networking.services).toEqual([
      {
        name: 'payments',
        namespace: 'management',
        ports: [{ name: 'http', port: 8080, protocol: 'TCP' }],
        readyEndpoints: 1,
        notReadyEndpoints: 0,
        createdAt: null,
      },
    ]);
    expect(s.workload.deployment).toMatchObject({ name: 'payments', replicas: 1, deadlineExceeded: false });
    expect(s.bindings).toEqual([
      {
        name: 'database',
        declaredByRelease: true,
        providerRef: { kind: 'Database', name: 'payments-db', namespace: 'management' },
        mountPath: '/bindings/database',
        externalSecret: {
          name: 'payments-binding-database',
          namespace: 'management',
          ready: true,
          reason: 'SecretSynced',
          refreshTime: '2026-09-24T09:47:58Z',
          remoteKey: '/bindings/management/databases/payments-db',
        },
        problem: null,
      },
    ]);
    expect(s.warnings).toEqual([]);
  });

  it('explains a crash loop with the last exit reason', () => {
    const objects = paymentsObjects();
    objects.pods[0].status = {
      phase: 'Running',
      containerStatuses: [
        {
          name: 'payments',
          ready: false,
          restartCount: 7,
          state: { waiting: { reason: 'CrashLoopBackOff' } },
          lastState: { terminated: { reason: 'OOMKilled', exitCode: 137 } },
        },
      ],
    };
    const [pod] = buildEnvironmentSummary('payments', 'management', objects, { includeSensitive: false }).workload.pods;
    expect(pod.problem).toEqual({
      kind: 'CrashLoop',
      state: 'terminated',
      reason: 'CrashLoopBackOff (last exit: OOMKilled)',
      exitCode: 137,
    });
  });

  it('reports an image pull failure and a Release/running-image mismatch', () => {
    const objects = paymentsObjects();
    objects.pods[0].spec = { containers: [{ name: 'payments', image: 'ghcr.io/entr0pian/payments:nope' }] };
    objects.pods[0].status = {
      phase: 'Pending',
      containerStatuses: [{ name: 'payments', ready: false, state: { waiting: { reason: 'ImagePullBackOff' } } }],
    };
    const s = buildEnvironmentSummary('payments', 'management', objects, { includeSensitive: false });
    expect(s.workload.pods[0].problem).toEqual({ kind: 'ImagePull', state: 'waiting', reason: 'ImagePullBackOff' });
    expect(s.workload.imageMatchesRelease).toBe(false);
  });

  it('flags a Release binding with no ExternalSecret instead of hiding it', () => {
    const s = buildEnvironmentSummary('payments', 'management', paymentsObjects({ externalSecrets: [] }), {
      includeSensitive: false,
    });
    expect(s.bindings[0]).toMatchObject({ name: 'database', externalSecret: null });
    expect(s.bindings[0].problem).toMatch(/no ExternalSecret/);
  });

  it('flags an ExternalSecret that has not synced', () => {
    const objects = paymentsObjects();
    objects.externalSecrets[0].status = {
      conditions: [{ type: 'Ready', status: 'False', reason: 'SecretSyncedError', message: 'could not get secret data' }],
    };
    const [binding] = buildEnvironmentSummary('payments', 'management', objects, { includeSensitive: false }).bindings;
    expect(binding.externalSecret?.ready).toBe(false);
    expect(binding.problem).toMatch(/SecretSyncedError/);
  });

  it('groups recent warning events for owned objects, and drops old or unrelated ones', () => {
    const objects = paymentsObjects({
      events: [
        {
          type: 'Warning',
          reason: 'BackOff',
          message: 'Back-off restarting failed container',
          count: 5,
          lastTimestamp: '2026-09-24T10:50:00Z',
          involvedObject: { kind: 'Pod', name: 'payments-568c859586-49zbz', namespace: 'management' },
        },
        {
          type: 'Warning',
          reason: 'BackOff',
          count: 7,
          lastTimestamp: '2026-09-24T10:55:00Z',
          involvedObject: { kind: 'Pod', name: 'payments-568c859586-49zbz', namespace: 'management' },
        },
        {
          type: 'Warning',
          reason: 'BackOff',
          count: 1,
          lastTimestamp: '2026-09-24T08:00:00Z', // older than 1h
          involvedObject: { kind: 'Pod', name: 'payments-568c859586-49zbz', namespace: 'management' },
        },
        {
          type: 'Warning',
          reason: 'FailedMount',
          count: 1,
          lastTimestamp: '2026-09-24T10:59:00Z',
          involvedObject: { kind: 'Pod', name: 'someone-else', namespace: 'management' },
        },
        {
          type: 'Normal',
          reason: 'Pulled',
          involvedObject: { kind: 'Pod', name: 'payments-568c859586-49zbz', namespace: 'management' },
        },
      ],
    });
    const s = buildEnvironmentSummary('payments', 'management', objects, { includeSensitive: false, now: NOW });
    expect(s.warnings).toEqual([
      {
        reason: 'BackOff',
        objectKind: 'Pod',
        objectName: 'payments-568c859586-49zbz',
        count: 12,
        lastSeen: '2026-09-24T10:55:00Z',
      },
    ]);
  });

  describe('redaction', () => {
    const withWarning = () =>
      paymentsObjects({
        events: [
          {
            type: 'Warning',
            reason: 'BackOff',
            message: 'Back-off restarting failed container payments',
            count: 1,
            lastTimestamp: '2026-09-24T10:59:00Z',
            involvedObject: { kind: 'Pod', name: 'payments-568c859586-49zbz', namespace: 'management' },
          },
        ],
      });

    it('omits event and ExternalSecret messages for guests', () => {
      const s = buildEnvironmentSummary('payments', 'management', withWarning(), { includeSensitive: false, now: NOW });
      expect(s.detailLevel).toBe('summary');
      expect(s.warnings[0]).not.toHaveProperty('message');
      expect(s.bindings[0].externalSecret).not.toHaveProperty('message');
      expect(JSON.stringify(s)).not.toContain('Back-off restarting');
    });

    it('includes them for the owner', () => {
      const s = buildEnvironmentSummary('payments', 'management', withWarning(), { includeSensitive: true, now: NOW });
      expect(s.detailLevel).toBe('owner');
      expect(s.warnings[0].message).toBe('Back-off restarting failed container payments');
      expect(s.bindings[0].externalSecret?.message).toBe('secret synced');
    });
  });

  it('accepts the Date timestamps @kubernetes/client-node returns, with several pods and events', () => {
    const objects = paymentsObjects();
    const [pod] = objects.pods;
    objects.pods = ['a', 'b', 'c'].map((suffix, i) => ({
      ...pod,
      metadata: { ...pod.metadata, name: `payments-568c859586-${suffix}`, creationTimestamp: new Date(Date.UTC(2026, 8, 24, 10, i)) },
    }));
    objects.events = [1, 2].map(minute => ({
      type: 'Warning',
      reason: 'Unhealthy',
      count: 1,
      lastTimestamp: new Date(Date.UTC(2026, 8, 24, 10, 50 + minute)),
      involvedObject: { kind: 'Pod', name: 'payments-568c859586-a', namespace: 'management' },
    }));
    const s = buildEnvironmentSummary('payments', 'management', objects, { includeSensitive: false, now: NOW });
    expect(s.workload.pods.map(p => p.createdAt)).toEqual([
      '2026-09-24T10:02:00.000Z',
      '2026-09-24T10:01:00.000Z',
      '2026-09-24T10:00:00.000Z',
    ]);
    expect(s.warnings).toEqual([
      expect.objectContaining({ reason: 'Unhealthy', count: 2, lastSeen: '2026-09-24T10:52:00.000Z' }),
    ]);
  });

  it('reports an unreachable cluster as Unknown, not as zero pods rolling out', () => {
    const objects = paymentsObjects({
      cluster: { name: null, reachable: false },
      deployments: [],
      replicaSets: [],
      pods: [],
    });
    const s = buildEnvironmentSummary('payments', 'management', objects, { includeSensitive: false });
    expect(s.cluster.reachable).toBe(false);
    expect(s.progress.phase).toBe('Unknown');
  });

  it('only counts ReplicaSets owned by the Deployment', () => {
    const objects = paymentsObjects();
    objects.replicaSets.push({
      metadata: {
        name: 'stray-abc',
        namespace: 'management',
        annotations: { 'deployment.kubernetes.io/revision': '9' },
        ownerReferences: [{ kind: 'Deployment', name: 'something-else' }],
      },
      spec: { replicas: 1, template: { spec: { containers: [{ image: 'x:y' }] } } },
      status: { replicas: 1 },
    });
    const s = buildEnvironmentSummary('payments', 'management', objects, { includeSensitive: false });
    expect(s.workload.replicaSets.map(r => r.name)).toEqual(['payments-568c859586']);
    expect(s.progress.phase).toBe('Healthy');
  });

  it('handles an environment with a Release but nothing running yet', () => {
    const s = buildEnvironmentSummary(
      'payments',
      'dev',
      {
        release: {
          name: 'payments-dev',
          namespace: 'dev',
          version: 'v1',
          bindings: {},
          ready: null,
        },
        cluster: { name: 'dev', reachable: true },
        deployments: [],
        replicaSets: [],
        pods: [],
        services: [],
        endpointSlices: {},
        externalSecrets: [],
        events: [],
      },
      { includeSensitive: false },
    );
    expect(s.workload).toEqual({
      desiredReplicas: 0,
      readyReplicas: 0,
      pods: [],
      runningImageTags: [],
      imageMatchesRelease: null,
      deployment: null,
      replicaSets: [],
    });
    expect(s.progress).toMatchObject({ phase: 'Pending', targetVersion: 'v1', previous: null });
    expect(s.release?.ready).toBeNull();
    expect(s.bindings).toEqual([]);
  });
});
