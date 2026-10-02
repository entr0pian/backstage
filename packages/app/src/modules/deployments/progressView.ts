// Pure presentation of the backend's DeploymentProgress for the Deployments
// tab: labels, the one-line rollout summary, and how often to poll. All the
// Kubernetes semantics are already decided server-side; nothing here looks
// at Deployments or ReplicaSets.
import type { DeploymentProgress, PodProblemKind, ProgressPhase } from './useEnvironmentDetails';
import { shortVersion } from '../platformUi';

// Fast while something is happening, slow otherwise. A healthy rollout of a
// small service can finish between two fast polls (~4s, DEPLOYMENT_CARD_
// FINDINGS_PART2.md); the fast rate is for the slow and stuck ones.
export const ACTIVE_INTERVAL_MS = 4_000;
export const IDLE_INTERVAL_MS = 30_000;

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
  if (previous && previous.current > 0) {
    parts.push(pods(previous.current));
  }
  return parts.join(' · ');
}

// 0–100 for a determinate progress bar; null when there's nothing to measure.
export function rolloutPercent(progress: DeploymentProgress): number | null {
  if (!progress.target || progress.desiredReplicas === 0) {
    return null;
  }
  return Math.min(100, Math.round((progress.target.ready / progress.desiredReplicas) * 100));
}
