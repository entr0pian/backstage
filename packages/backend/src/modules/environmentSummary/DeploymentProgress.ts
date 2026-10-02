// Pure derivation: one component's environment (Release target + workload
// Deployment, ReplicaSets and Pods) -> where its rollout is. No I/O. Rules
// and the observations behind them: platform-architecture's
// DEPLOYMENT_CARD_IMPLEMENTATION_PART1.md and DEPLOYMENT_CARD_FINDINGS_PART2.md.
//
// ReplicaSets are the unit: one per Deployment revision, each with its own
// image and pod counts. The Deployment's aggregate counters are never used
// for progress (its readyReplicas counts old and new pods: 4/3 during surge).

export type PodProblemKind = 'ImagePull' | 'CrashLoop' | 'Other';

export interface ReplicaSetSummary {
  name: string;
  namespace: string;
  // deployment.kubernetes.io/revision; Kubernetes bumps it when a rollback
  // reuses an old ReplicaSet, so the highest revision is the current template.
  revision: number | null;
  version: string | null; // template image tag
  desired: number;
  current: number;
  ready: number;
  available: number;
  createdAt: string | null;
}

export interface DeploymentRollout {
  generation: number | null;
  observedGeneration: number | null;
  replicas: number; // spec.replicas: the desired count progress is measured against
  deadlineExceeded: boolean; // Progressing=False/ProgressDeadlineExceeded
  // When the Deployment last reported its newest ReplicaSet fully available
  // (Progressing=True/NewReplicaSetAvailable, lastUpdateTime).
  completedAt: string | null;
}

export interface ProgressPod {
  name: string;
  createdAt: string | null;
  replicaSet: string | null;
  problem: { kind: PodProblemKind; reason: string } | null;
}

export type ProgressPhase = 'Pending' | 'RollingOut' | 'Stalled' | 'RolloutFailed' | 'Healthy' | 'Unknown';

export interface DeploymentProgress {
  phase: ProgressPhase;
  targetVersion: string | null; // Release.spec.version
  desiredReplicas: number;
  // The revision Kubernetes is rolling toward; null until it matches the target.
  target: { revision: number | null; version: string | null; ready: number; available: number } | null;
  // The revision before it (still serving or retained at 0). While Pending,
  // the revision currently running.
  previous: { revision: number | null; version: string | null; current: number; ready: number } | null;
  // Problems of the target revision's pods only.
  problems: { pod: string; kind: PodProblemKind; reason: string }[];
  // When the rollout to the target revision began: its earliest pod's
  // creation (a rollback reuses an old ReplicaSet, whose own creation time
  // can be weeks earlier), else the ReplicaSet's. Null until it exists.
  startedAt: string | null;
  // When it finished; only set once Healthy.
  completedAt: string | null;
}

// Kinds that mean "this rollout won't make progress on its own". A pod that
// is merely Running and not yet ready is normal startup, not a problem.
const STALLING: PodProblemKind[] = ['ImagePull', 'CrashLoop'];

export function byRevisionDesc(a: ReplicaSetSummary, b: ReplicaSetSummary): number {
  return (b.revision ?? -1) - (a.revision ?? -1);
}

export function deriveProgress(input: {
  reachable: boolean;
  targetVersion: string | null;
  deployment: DeploymentRollout | null;
  replicaSets: ReplicaSetSummary[];
  pods: ProgressPod[];
}): DeploymentProgress {
  const { reachable, targetVersion, deployment } = input;
  const desiredReplicas = deployment?.replicas ?? 0;
  const base = { targetVersion, desiredReplicas, target: null, previous: null, problems: [], startedAt: null, completedAt: null };

  if (!reachable || targetVersion === null) {
    return { ...base, phase: 'Unknown' };
  }

  const [newest, ...older] = [...input.replicaSets].sort(byRevisionDesc);
  const asPrevious = (rs: ReplicaSetSummary | undefined) =>
    rs ? { revision: rs.revision, version: rs.version, current: rs.current, ready: rs.ready } : null;

  // Kubernetes hasn't received the target's template yet (first deploy, or
  // the highest revision is still another version — including a rollback that
  // hasn't been applied). Pending comes before RolloutFailed: a deadline
  // condition left over from the previous attempt doesn't apply to this one.
  if (!deployment || !newest || newest.version !== targetVersion) {
    return { ...base, phase: 'Pending', previous: asPrevious(newest) };
  }

  const targetPods = input.pods.filter(p => p.replicaSet === newest.name);
  const problems = targetPods
    .filter(p => p.problem)
    .map(p => ({ pod: p.name, kind: p.problem!.kind, reason: p.problem!.reason }));
  const earliestPod = targetPods
    .map(p => p.createdAt)
    .filter((t): t is string => !!t)
    .sort()[0];
  const progress = {
    ...base,
    target: { revision: newest.revision, version: newest.version, ready: newest.ready, available: newest.available },
    previous: asPrevious(older[0]),
    problems,
    startedAt: earliestPod ?? newest.createdAt,
  };

  if (deployment.deadlineExceeded) {
    return { ...progress, phase: 'RolloutFailed' };
  }
  if (problems.some(p => STALLING.includes(p.kind))) {
    return { ...progress, phase: 'Stalled' };
  }
  const rolling =
    (deployment.generation !== null &&
      deployment.observedGeneration !== null &&
      deployment.generation !== deployment.observedGeneration) ||
    newest.ready < desiredReplicas ||
    newest.available < desiredReplicas ||
    older.some(rs => rs.current > 0);
  return rolling
    ? { ...progress, phase: 'RollingOut' }
    : { ...progress, phase: 'Healthy', completedAt: deployment.completedAt };
}
