// Pure presentation of the backend's DeploymentProgress for the Deployments
// tab: labels, the one-line rollout summary, and how often to poll. All the
// Kubernetes semantics are already decided server-side; nothing here looks
// at Deployments or ReplicaSets.
import type { DeploymentProgress, PodProblemKind, ProgressPhase } from './useEnvironmentDetails';
import { shortVersion, timeAgo } from '../platformUi';

// Fast while something is happening, slow otherwise. A healthy rollout of a
// small service can finish between two fast polls (~4s, DEPLOYMENT_CARD_
// FINDINGS_PART2.md); the fast rate is for the slow and stuck ones. The idle
// rate is how long a newly applied Release waits to be noticed: Argo CD
// refreshes on Git webhooks, so this poll is the slowest hop left.
export const ACTIVE_INTERVAL_MS = 4_000;
export const IDLE_INTERVAL_MS = 10_000;

const ACTIVE: ProgressPhase[] = ['Pending', 'RollingOut', 'Stalled'];

export function isActive(phase: ProgressPhase): boolean {
  return ACTIVE.includes(phase);
}

export function pollInterval(phases: ProgressPhase[]): number {
  return phases.some(isActive) ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
}

export function phaseLabel(progress: DeploymentProgress, clusterReachable: boolean): string {
  switch (progress.phase) {
    case 'Healthy':
      return 'Healthy';
    case 'Pending':
      return 'Waiting to roll out';
    case 'RollingOut':
      return 'Rolling out';
    case 'Stalled':
      return 'Needs attention';
    case 'RolloutFailed':
      return 'Rollout failed';
    default:
      return clusterReachable ? 'Unknown' : 'Cluster unavailable';
  }
}

export function problemLabel(kind: PodProblemKind, reason: string): string {
  switch (kind) {
    case 'ImagePull':
      return 'Image pull problem';
    case 'CrashLoop':
      return 'Container keeps crashing';
    default:
      return reason;
  }
}

const v = (version: string | null) => (version ? shortVersion(version) : '—');
const pods = (n: number) => `${n} old pod${n === 1 ? '' : 's'} serving`;

// "e692041 → dd9fc0e · 2 / 3 ready · 1 old pod serving", or for a rollout
// that hasn't reached the cluster yet "e692041 → dd9fc0e · waiting for the
// cluster · 3 old pods serving". A configuration-only rollout reads
// "dd9fc0e → dd9fc0e", which is what it is.
export function rolloutLine(progress: DeploymentProgress): string {
  const { target, previous, desiredReplicas, targetVersion } = progress;
  const from = previous ? `${v(previous.version)} → ` : '';
  if (!target) {
    const serving = previous && previous.ready > 0 ? ` · ${pods(previous.ready)}` : '';
    return `${from}${v(targetVersion)} · waiting for the cluster${serving}`;
  }
  const parts = [`${from}${v(target.version)}`, `${target.ready} / ${desiredReplicas} ready`];
  // Ready but not yet available (minReadySeconds): Kubernetes won't replace
  // the next old pod until these count, so say they're still starting.
  const starting = target.ready - target.available;
  if (starting > 0) {
    parts.push(`${starting} starting`);
  }
  if (previous && previous.current > 0) {
    parts.push(pods(previous.current));
  }
  return parts.join(' · ');
}

// 0–100 for the rollout bar: `available` pods are done (solid), `ready` ones
// include those still starting (the bar's moving buffer). Null when there's
// nothing to measure.
export function rolloutBar(progress: DeploymentProgress): { available: number; ready: number } | null {
  const { target, desiredReplicas } = progress;
  if (!target || desiredReplicas === 0) {
    return null;
  }
  const pct = (n: number) => Math.min(100, Math.round((n / desiredReplicas) * 100));
  return { available: pct(target.available), ready: pct(target.ready) };
}

// "45s", "1m 05s", "2h 03m".
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
}

export interface TimingTile {
  label: string;
  value: string;
  context: string | null;
}

const ms = (iso: string) => new Date(iso).getTime();

// The card's timing tile, from the rollout's own start/finish — not Argo
// CD's last sync, which also moves on chart-only changes. Null when the
// rollout state isn't known; the card then falls back to Argo CD.
export function timingTile(progress: DeploymentProgress, now: number = Date.now()): TimingTile | null {
  const { phase, startedAt, completedAt } = progress;
  switch (phase) {
    case 'Healthy': {
      if (!completedAt) return null;
      const took = startedAt && ms(startedAt) <= ms(completedAt) ? formatDuration(ms(completedAt) - ms(startedAt)) : null;
      return { label: 'Rolled out', value: timeAgo(completedAt, now) ?? '—', context: took && `took ${took}` };
    }
    case 'RollingOut':
    case 'Stalled':
      // The counter is the whole story; a minute-rounded "started 1m ago"
      // next to "for 40s" would only contradict it.
      return {
        label: 'Rolling out',
        value: startedAt ? `for ${formatDuration(now - ms(startedAt))}` : 'starting',
        context: null,
      };
    case 'RolloutFailed':
      return {
        label: 'Rollout',
        value: 'failed',
        context: startedAt ? `started ${timeAgo(startedAt, now)}` : null,
      };
    case 'Pending':
      return { label: 'Rollout', value: 'waiting', context: 'for the cluster to receive it' };
    default:
      return null;
  }
}

// How an environment's card draws attention to it (platformUi EnvironmentCard):
// moving while a deployment is in flight, slower and amber when it's stuck,
// a still red frame when it failed, one green glow when it has just finished.
export type CardActivity = 'active' | 'attention' | 'failed' | 'completed';

export function cardActivity(phase: ProgressPhase, justFinished: boolean): CardActivity | undefined {
  switch (phase) {
    case 'Pending':
    case 'RollingOut':
      return 'active';
    case 'Stalled':
      return 'attention';
    case 'RolloutFailed':
      return 'failed';
    case 'Healthy':
      return justFinished ? 'completed' : undefined;
    default:
      return undefined;
  }
}
