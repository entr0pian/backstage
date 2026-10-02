import {
  deriveProgress,
  type DeploymentRollout,
  type ProgressPod,
  type ReplicaSetSummary,
} from './DeploymentProgress';

// W -> X, as observed on payments in dev (DEPLOYMENT_CARD_FINDINGS_PART2.md).
const W = 'e692041';
const X = 'dd9fc0e';

function rs(revision: number, version: string, counts: Partial<ReplicaSetSummary> = {}): ReplicaSetSummary {
  return {
    name: `payments-rev${revision}`,
    namespace: 'dev',
    revision,
    version,
    desired: 0,
    current: 0,
    ready: 0,
    available: 0,
    createdAt: null,
    ...counts,
  };
}

const settled: DeploymentRollout = { generation: 3, observedGeneration: 3, replicas: 3, deadlineExceeded: false };

function derive(overrides: {
  targetVersion?: string | null;
  deployment?: DeploymentRollout | null;
  replicaSets?: ReplicaSetSummary[];
  pods?: ProgressPod[];
  reachable?: boolean;
}) {
  return deriveProgress({
    reachable: true,
    targetVersion: X,
    deployment: settled,
    replicaSets: [],
    pods: [],
    ...overrides,
  });
}

describe('deriveProgress', () => {
  it('is Healthy once the target revision is fully ready and the previous one is at 0', () => {
    const p = derive({
      replicaSets: [rs(1, W), rs(2, X, { desired: 3, current: 3, ready: 3, available: 3 })],
    });
    expect(p).toMatchObject({
      phase: 'Healthy',
      targetVersion: X,
      desiredReplicas: 3,
      target: { revision: 2, version: X, ready: 3, available: 3 },
      previous: { revision: 1, version: W, current: 0, ready: 0 },
      problems: [],
    });
  });

  it('is Pending while only the previous version exists, and reports it as what is running', () => {
    const p = derive({ replicaSets: [rs(1, W, { desired: 3, current: 3, ready: 3, available: 3 })] });
    expect(p).toMatchObject({ phase: 'Pending', target: null, previous: { revision: 1, version: W, ready: 3 } });
  });

  it('is Pending on a first deploy with nothing in the cluster yet', () => {
    const p = derive({ deployment: null, replicaSets: [] });
    expect(p).toMatchObject({ phase: 'Pending', target: null, previous: null, desiredReplicas: 0 });
  });

  it('measures progress against the Deployment, not its surge-inflated aggregate or the RS step', () => {
    // Deployment readyReplicas would be 4 here (1 X + 3 W); X's own desired is 1.
    const p = derive({
      deployment: { ...settled, generation: 4, observedGeneration: 4 },
      replicaSets: [
        rs(1, W, { desired: 3, current: 3, ready: 3, available: 3 }),
        rs(2, X, { desired: 1, current: 1, ready: 1, available: 1 }),
      ],
    });
    expect(p.phase).toBe('RollingOut');
    expect(p.target).toMatchObject({ ready: 1 });
    expect(p.desiredReplicas).toBe(3); // 1 / 3, never 4 / 3 or 1 / 1
    expect(p.previous).toMatchObject({ current: 3, ready: 3 });
  });

  it('is RollingOut mid-rollout with old pods still serving', () => {
    const p = derive({
      replicaSets: [
        rs(1, W, { desired: 1, current: 1, ready: 1, available: 1 }),
        rs(2, X, { desired: 3, current: 3, ready: 2, available: 2 }),
      ],
    });
    expect(p).toMatchObject({ phase: 'RollingOut', target: { ready: 2 }, previous: { current: 1 } });
  });

  it('is RollingOut while the Deployment controller has not observed the latest generation', () => {
    const p = derive({
      deployment: { ...settled, generation: 4 },
      replicaSets: [rs(2, X, { desired: 3, current: 3, ready: 3, available: 3 })],
    });
    expect(p.phase).toBe('RollingOut');
  });

  it('treats a rollback that has not reached Kubernetes as Pending, not as a rollout of the old RS', () => {
    // Release back to W; X (rev 2) still runs; W's RS is retained at 0 (rev 1).
    const p = derive({
      targetVersion: W,
      replicaSets: [rs(1, W), rs(2, X, { desired: 3, current: 3, ready: 3, available: 3 })],
    });
    expect(p).toMatchObject({ phase: 'Pending', target: null, previous: { revision: 2, version: X } });
  });

  it('follows a rollback once Kubernetes reuses the old RS under a new revision', () => {
    const p = derive({
      targetVersion: W,
      replicaSets: [
        rs(3, W, { desired: 1, current: 1, ready: 1, available: 1 }), // was rev 1
        rs(2, X, { desired: 3, current: 3, ready: 3, available: 3 }),
      ],
    });
    expect(p).toMatchObject({ phase: 'RollingOut', target: { revision: 3, version: W }, previous: { revision: 2 } });
  });

  it('keeps a configuration-only rollout as two revisions of the same version', () => {
    const p = derive({
      replicaSets: [
        rs(3, X, { desired: 2, current: 2, ready: 2, available: 2 }),
        rs(4, X, { desired: 2, current: 2, ready: 1, available: 1 }),
      ],
    });
    expect(p).toMatchObject({
      phase: 'RollingOut',
      target: { revision: 4, version: X },
      previous: { revision: 3, version: X, current: 2 },
    });
  });

  it('is Stalled when a target pod cannot pull its image, with the previous version still serving', () => {
    const p = derive({
      replicaSets: [
        rs(1, W, { desired: 3, current: 3, ready: 3, available: 3 }),
        rs(2, X, { desired: 1, current: 1 }),
      ],
      pods: [
        { name: 'payments-rev2-abcde', replicaSet: 'payments-rev2', problem: { kind: 'ImagePull', reason: 'ImagePullBackOff' } },
        { name: 'payments-rev1-fghij', replicaSet: 'payments-rev1', problem: null },
      ],
    });
    expect(p).toMatchObject({
      phase: 'Stalled',
      previous: { current: 3, ready: 3 },
      problems: [{ pod: 'payments-rev2-abcde', kind: 'ImagePull', reason: 'ImagePullBackOff' }],
    });
  });

  it('ignores problems of pods outside the target revision', () => {
    const p = derive({
      replicaSets: [
        rs(1, W, { desired: 1, current: 1 }),
        rs(2, X, { desired: 3, current: 3, ready: 3, available: 3 }),
      ],
      pods: [{ name: 'payments-rev1-old', replicaSet: 'payments-rev1', problem: { kind: 'CrashLoop', reason: 'CrashLoopBackOff' } }],
    });
    expect(p).toMatchObject({ phase: 'RollingOut', problems: [] });
  });

  it('does not call normal startup Stalled (Running, not ready yet, no problem)', () => {
    const p = derive({
      replicaSets: [
        rs(1, W, { desired: 3, current: 3, ready: 3, available: 3 }),
        rs(2, X, { desired: 1, current: 1 }),
      ],
      pods: [{ name: 'payments-rev2-abcde', replicaSet: 'payments-rev2', problem: null }],
    });
    expect(p.phase).toBe('RollingOut');
  });

  it('surfaces an Other problem without calling the rollout Stalled', () => {
    const p = derive({
      replicaSets: [rs(1, W, { current: 3, ready: 3 }), rs(2, X, { desired: 1, current: 1 })],
      pods: [{ name: 'p', replicaSet: 'payments-rev2', problem: { kind: 'Other', reason: 'CreateContainerConfigError' } }],
    });
    expect(p).toMatchObject({ phase: 'RollingOut', problems: [{ kind: 'Other' }] });
  });

  it('is RolloutFailed once the progress deadline is exceeded, even with a pod problem', () => {
    const p = derive({
      deployment: { ...settled, deadlineExceeded: true },
      replicaSets: [rs(1, W, { current: 3, ready: 3 }), rs(2, X, { desired: 1, current: 1 })],
      pods: [{ name: 'p', replicaSet: 'payments-rev2', problem: { kind: 'CrashLoop', reason: 'CrashLoopBackOff' } }],
    });
    expect(p.phase).toBe('RolloutFailed');
  });

  it('shows a newly requested version as Pending even while the previous attempt has failed', () => {
    const p = derive({
      targetVersion: 'f00ba47',
      deployment: { ...settled, deadlineExceeded: true },
      replicaSets: [rs(1, W, { current: 3, ready: 3 }), rs(2, X, { desired: 1, current: 1 })],
    });
    expect(p).toMatchObject({ phase: 'Pending', previous: { version: X } });
  });

  it('is Unknown when the workload cluster is unreachable', () => {
    expect(derive({ reachable: false, replicaSets: [] }).phase).toBe('Unknown');
  });

  it('is Unknown without a Release, and invents no target', () => {
    const p = derive({ targetVersion: null, replicaSets: [rs(1, W, { current: 3, ready: 3 })] });
    expect(p).toMatchObject({ phase: 'Unknown', targetVersion: null, target: null });
  });
});
