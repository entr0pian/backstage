import {
  ACTIVE_INTERVAL_MS,
  IDLE_INTERVAL_MS,
  formatDuration,
  timingTile,
  phaseLabel,
  pollInterval,
  problemLabel,
  rolloutLine,
  rolloutBar,
} from './progressView';
import type { DeploymentProgress } from './useEnvironmentDetails';

const W = 'e692041c498a0d4ee4efad2563667d87af3d1fbc';
const X = 'dd9fc0e4a089f9d8c87140e7dc1f0dc9f4047a5e';

function progress(overrides: Partial<DeploymentProgress>): DeploymentProgress {
  return {
    phase: 'RollingOut',
    targetVersion: X,
    desiredReplicas: 3,
    target: { revision: 2, version: X, ready: 2, available: 2 },
    previous: { revision: 1, version: W, current: 1, ready: 1 },
    problems: [],
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('progressView', () => {
  it('polls fast only while some environment is mid-deployment', () => {
    expect(pollInterval(['Healthy', 'RollingOut'])).toBe(ACTIVE_INTERVAL_MS);
    expect(pollInterval(['Healthy', 'Pending'])).toBe(ACTIVE_INTERVAL_MS);
    expect(pollInterval(['Healthy', 'Stalled'])).toBe(ACTIVE_INTERVAL_MS);
    expect(pollInterval(['Healthy', 'RolloutFailed', 'Unknown'])).toBe(IDLE_INTERVAL_MS);
    expect(pollInterval([])).toBe(IDLE_INTERVAL_MS);
  });

  it('summarises a rollout in one line', () => {
    expect(rolloutLine(progress({}))).toBe('e692041 → dd9fc0e · 2 / 3 ready · 1 old pod serving');
    expect(rolloutLine(progress({ previous: { revision: 1, version: W, current: 0, ready: 0 } }))).toBe(
      'e692041 → dd9fc0e · 2 / 3 ready',
    );
  });

  it('says a pending deployment is waiting, with what still serves', () => {
    const p = progress({ phase: 'Pending', target: null, previous: { revision: 1, version: W, current: 3, ready: 3 } });
    expect(rolloutLine(p)).toBe('e692041 → dd9fc0e · waiting for the cluster · 3 old pods serving');
    expect(rolloutLine(progress({ phase: 'Pending', target: null, previous: null }))).toBe(
      'dd9fc0e · waiting for the cluster',
    );
  });

  it('shows a configuration-only rollout as the same version on both sides', () => {
    const p = progress({ previous: { revision: 3, version: X, current: 2, ready: 2 } });
    expect(rolloutLine(p)).toBe('dd9fc0e → dd9fc0e · 2 / 3 ready · 2 old pods serving');
  });

  it('measures the bar against the desired replicas', () => {
    expect(rolloutBar(progress({}))).toEqual({ available: 67, ready: 67 });
    expect(rolloutBar(progress({ target: { revision: 2, version: X, ready: 2, available: 1 } }))).toEqual({
      available: 33,
      ready: 67,
    });
    expect(rolloutBar(progress({ target: null }))).toBeNull();
    expect(rolloutBar(progress({ desiredReplicas: 0 }))).toBeNull();
  });

  it('says when ready pods are still starting (minReadySeconds)', () => {
    const p = progress({ target: { revision: 2, version: X, ready: 1, available: 0 }, previous: { revision: 1, version: W, current: 3, ready: 3 } });
    expect(rolloutLine(p)).toBe('e692041 → dd9fc0e · 1 / 3 ready · 1 starting · 3 old pods serving');
  });

  it('labels an unreachable cluster as unavailable, not failed', () => {
    expect(phaseLabel(progress({ phase: 'Unknown' }), false)).toBe('Cluster unavailable');
    expect(phaseLabel(progress({ phase: 'Unknown' }), true)).toBe('Unknown');
    expect(phaseLabel(progress({ phase: 'Stalled' }), true)).toBe('Needs attention');
  });

  it('names problem kinds, and falls back to the raw reason', () => {
    expect(problemLabel('ImagePull', 'ImagePullBackOff')).toBe('Image pull problem');
    expect(problemLabel('CrashLoop', 'CrashLoopBackOff (last exit: Error)')).toBe('Container keeps crashing');
    expect(problemLabel('Other', 'CreateContainerConfigError')).toBe('CreateContainerConfigError');
  });

  it('formats durations compactly', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(65_000)).toBe('1m 05s');
    expect(formatDuration(2 * 3600_000 + 3 * 60_000)).toBe('2h 03m');
    expect(formatDuration(-5)).toBe('0s');
  });

  describe('timingTile', () => {
    const now = new Date('2026-10-02T12:06:14Z').getTime();

    it('says when a healthy rollout finished and how long it took', () => {
      const t = timingTile(
        progress({ phase: 'Healthy', startedAt: '2026-10-02T11:51:09Z', completedAt: '2026-10-02T11:52:14Z' }),
        now,
      );
      expect(t).toEqual({ label: 'Rolled out', value: '14m ago', context: 'took 1m 05s' });
    });

    it('drops the duration when the start is after the finish (pods replaced since)', () => {
      const t = timingTile(
        progress({ phase: 'Healthy', startedAt: '2026-10-02T12:00:00Z', completedAt: '2026-10-02T11:52:14Z' }),
        now,
      );
      expect(t).toEqual({ label: 'Rolled out', value: '14m ago', context: null });
    });

    it('counts up while rolling out or stalled', () => {
      expect(timingTile(progress({ phase: 'RollingOut', startedAt: '2026-10-02T12:05:34Z' }), now)).toEqual({
        label: 'Rolling out',
        value: 'for 40s',
        context: null,
      });
      expect(timingTile(progress({ phase: 'Stalled', startedAt: '2026-10-02T12:01:14Z' }), now)?.value).toBe('for 5m 00s');
    });

    it('covers pending and failed rollouts', () => {
      expect(timingTile(progress({ phase: 'Pending', target: null }), now)).toMatchObject({ value: 'waiting' });
      expect(timingTile(progress({ phase: 'RolloutFailed', startedAt: '2026-10-02T11:56:14Z' }), now)).toEqual({
        label: 'Rollout',
        value: 'failed',
        context: 'started 10m ago',
      });
    });

    it('defers to Argo CD when the rollout state is unknown', () => {
      expect(timingTile(progress({ phase: 'Unknown' }), now)).toBeNull();
      expect(timingTile(progress({ phase: 'Healthy', completedAt: null }), now)).toBeNull();
    });
  });
});
