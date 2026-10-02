// Pure: the steps of an environment's current rollout, from Kubernetes
// events — "Scaled up dd9fc0e 1 → 2", "Pulling image", "Container started".
// Only events about this rollout's objects (the Deployment, the target and
// previous ReplicaSets, the target's pods) since it began. No I/O.
//
// Each step has a `summary` built from the event's reason (and, for scaling,
// its counts) that is safe for guests; the raw `message`, which can name
// nodes and image paths, is owner-only — same rule as warnings.

import type { ReplicaSetSummary } from './DeploymentProgress';

export interface RolloutEventInput {
  type?: string;
  reason?: string;
  message?: string;
  count?: number;
  at: string | null;
  involvedObject?: { kind?: string; name?: string };
}

export interface RolloutStep {
  at: string;
  type: 'Normal' | 'Warning';
  reason: string;
  objectKind: string;
  objectName: string;
  summary: string;
  count: number;
  message?: string; // owner only
}

export const ROLLOUT_STEPS_LIMIT = 8;
// Events can be stamped slightly before the earliest pod (the ReplicaSet is
// scaled first), so the window opens a little early.
const LEAD_MS = 15_000;

const SUMMARIES: Record<string, string> = {
  Scheduled: 'Pod scheduled',
  Pulling: 'Pulling image',
  Pulled: 'Image pulled',
  Created: 'Container created',
  Started: 'Container started',
  Killing: 'Stopping container',
  SuccessfulCreate: 'Pod created',
  SuccessfulDelete: 'Pod deleted',
  Unhealthy: 'Health check failed',
  BackOff: 'Restart back-off',
  Failed: 'Failed',
  FailedScheduling: "Couldn't schedule pod",
  FailedMount: "Couldn't mount volume",
};

const SCALING = /Scaled (up|down) replica set (\S+) (?:from (\d+) )?to (\d+)/;

function summarize(
  reason: string,
  message: string | undefined,
  versionOf: (replicaSet: string) => string | null,
): string {
  if (reason === 'ScalingReplicaSet') {
    const m = message?.match(SCALING);
    if (m) {
      const [, direction, rs, from, to] = m;
      const version = versionOf(rs)?.slice(0, 7) ?? 'a revision';
      return `Scaled ${direction} ${version} ${from !== undefined ? `${from} → ${to}` : `to ${to}`}`;
    }
    return 'Scaled a revision';
  }
  return SUMMARIES[reason] ?? reason;
}

export function buildRolloutSteps(input: {
  events: RolloutEventInput[];
  deploymentName: string | null;
  // Newest revision first, as in the summary.
  replicaSets: ReplicaSetSummary[];
  targetPodNames: string[];
  startedAt: string | null;
  includeSensitive: boolean;
}): RolloutStep[] {
  const [target, previous] = input.replicaSets;
  if (!target) {
    return [];
  }
  const since = new Date(input.startedAt ?? target.createdAt ?? 0).getTime() - LEAD_MS;
  const owned = new Set<string>([
    ...(input.deploymentName ? [`Deployment/${input.deploymentName}`] : []),
    `ReplicaSet/${target.name}`,
    ...(previous ? [`ReplicaSet/${previous.name}`] : []),
    ...input.targetPodNames.map(name => `Pod/${name}`),
  ]);
  const versions = new Map(input.replicaSets.map(rs => [rs.name, rs.version]));
  const versionOf = (rs: string) => versions.get(rs) ?? null;

  return input.events
    .filter(e => {
      const kind = e.involvedObject?.kind;
      const name = e.involvedObject?.name;
      return e.at && e.reason && kind && name && owned.has(`${kind}/${name}`) && new Date(e.at).getTime() >= since;
    })
    .sort((a, b) => a.at!.localeCompare(b.at!))
    .slice(-ROLLOUT_STEPS_LIMIT)
    .map(e => ({
      at: e.at!,
      type: e.type === 'Warning' ? 'Warning' : 'Normal',
      reason: e.reason!,
      objectKind: e.involvedObject!.kind!,
      objectName: e.involvedObject!.name!,
      summary: summarize(e.reason!, e.message, versionOf),
      count: e.count ?? 1,
      ...(input.includeSensitive ? { message: e.message ?? '' } : {}),
    }));
}
