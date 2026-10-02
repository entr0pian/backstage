import type { ReplicaSetSummary } from './DeploymentProgress';
import { buildRolloutSteps, ROLLOUT_STEPS_LIMIT, type RolloutEventInput } from './RolloutEvents';

const W = 'e692041c498a0d4ee4efad2563667d87af3d1fbc';
const X = 'dd9fc0e4a089f9d8c87140e7dc1f0dc9f4047a5e';

const rs = (name: string, revision: number, version: string): ReplicaSetSummary => ({
  name,
  namespace: 'dev',
  revision,
  version,
  desired: 0,
  current: 0,
  ready: 0,
  available: 0,
  createdAt: '2026-10-02T11:52:10Z',
});

const replicaSets = [rs('payments-65d876f48b', 2, X), rs('payments-6cb9c7fc5f', 1, W)];

const ev = (at: string, kind: string, name: string, reason: string, message: string, type = 'Normal'): RolloutEventInput => ({
  at,
  type,
  reason,
  message,
  count: 1,
  involvedObject: { kind, name },
});

// The real W -> X rollout of payments in dev (DEPLOYMENT_CARD_FINDINGS_PART2.md).
const events: RolloutEventInput[] = [
  ev('2026-10-02T11:48:33Z', 'Deployment', 'payments', 'ScalingReplicaSet', 'Scaled up replica set payments-6cb9c7fc5f from 1 to 3'),
  ev('2026-10-02T11:52:10Z', 'Deployment', 'payments', 'ScalingReplicaSet', 'Scaled up replica set payments-65d876f48b from 0 to 1'),
  ev('2026-10-02T11:52:10Z', 'Pod', 'payments-65d876f48b-sphrq', 'Scheduled', 'Successfully assigned dev/payments-65d876f48b-sphrq to ip-172-31-26-29.eu-west-1.compute.internal'),
  ev('2026-10-02T11:52:10Z', 'Pod', 'payments-65d876f48b-sphrq', 'Pulling', `Pulling image "ghcr.io/entr0pian/payments:${X}"`),
  ev('2026-10-02T11:52:12Z', 'Pod', 'payments-65d876f48b-sphrq', 'Started', 'Started container payments'),
  ev('2026-10-02T11:52:12Z', 'Deployment', 'payments', 'ScalingReplicaSet', 'Scaled down replica set payments-6cb9c7fc5f from 3 to 2'),
  ev('2026-10-02T11:52:12Z', 'Pod', 'payments-6cb9c7fc5f-k24hl', 'Killing', 'Stopping container payments'),
  ev('2026-10-02T11:52:13Z', 'Pod', 'unrelated-abc', 'Started', 'Started container other'),
];

const build = (overrides: Partial<Parameters<typeof buildRolloutSteps>[0]> = {}) =>
  buildRolloutSteps({
    events,
    deploymentName: 'payments',
    replicaSets,
    targetPodNames: ['payments-65d876f48b-sphrq'],
    startedAt: '2026-10-02T11:52:10Z',
    includeSensitive: false,
    ...overrides,
  });

describe('buildRolloutSteps', () => {
  it('lists the current rollout in order, in words a guest can read', () => {
    expect(build().map(s => s.summary)).toEqual([
      'Scaled up dd9fc0e 0 → 1',
      'Pod scheduled',
      'Pulling image',
      'Container started',
      'Scaled down e692041 3 → 2',
    ]);
  });

  it('leaves out earlier rollouts, old pods and unrelated objects', () => {
    const names = build().map(s => `${s.objectKind}/${s.objectName}`);
    expect(names).not.toContain('Pod/payments-6cb9c7fc5f-k24hl');
    expect(names).not.toContain('Pod/unrelated-abc');
    expect(build().some(s => s.at === '2026-10-02T11:48:33Z')).toBe(false);
  });

  it('keeps raw messages (node names, image paths) for the owner only', () => {
    expect(build()[1]).not.toHaveProperty('message');
    expect(build({ includeSensitive: true })[1].message).toContain('ip-172-31-26-29');
  });

  it('keeps only the latest steps', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      ev(`2026-10-02T11:53:${String(i).padStart(2, '0')}Z`, 'Pod', 'payments-65d876f48b-sphrq', 'Unhealthy', 'probe', 'Warning'),
    );
    const steps = build({ events: many });
    expect(steps).toHaveLength(ROLLOUT_STEPS_LIMIT);
    expect(steps[steps.length - 1].at).toBe('2026-10-02T11:53:19Z');
    expect(steps[0]).toMatchObject({ type: 'Warning', summary: 'Health check failed' });
  });

  it('has nothing to show without a target revision', () => {
    expect(build({ replicaSets: [] })).toEqual([]);
  });

  it('falls back to the raw reason for unknown events', () => {
    const steps = build({ events: [ev('2026-10-02T11:52:11Z', 'Pod', 'payments-65d876f48b-sphrq', 'SomethingNew', 'x')] });
    expect(steps[0].summary).toBe('SomethingNew');
  });
});
