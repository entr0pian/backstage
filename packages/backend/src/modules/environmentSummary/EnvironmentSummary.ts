// Pure join + redaction: Kubernetes objects selected by the platform label
// contract (platform.taskapp.io/{component,environment}, BACKSTAGE_PART8.md)
// plus the environment's Release -> one platform-shaped summary for the
// Deployments tab's Details drawer (BACKSTAGE_PART9.md Part A). No I/O
// here — see EnvironmentSummaryReader.ts.
//
// Grouped by what things mean to a developer (workload / networking /
// bindings / warnings), not by Kubernetes kind. Never sees secret values:
// the reader doesn't fetch Secrets, and nothing here reads secret data.
//
// Rollout progress (DeploymentProgress.ts) is derived here too, from the
// same objects, so the frontend only renders it.

import {
  byRevisionDesc,
  deriveProgress,
  type DeploymentProgress,
  type DeploymentRollout,
  type PodProblemKind,
  type ReplicaSetSummary,
} from './DeploymentProgress';

// --- input shapes (subsets of the Kubernetes objects actually read) -------

// @kubernetes/client-node deserializes typed objects' timestamps into Date
// objects; custom objects (and test fixtures) carry the raw ISO string.
// Everything leaving this module is an ISO string (iso()).
export type Timestamp = string | Date;

export function iso(t: Timestamp | undefined | null): string | null {
  if (!t) return null;
  return t instanceof Date ? t.toISOString() : t;
}

export interface K8sMeta {
  name?: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: Timestamp;
  generation?: number;
  ownerReferences?: { kind?: string; name?: string }[];
}

export interface K8sDeployment {
  metadata?: K8sMeta;
  spec?: { replicas?: number };
  status?: {
    observedGeneration?: number;
    readyReplicas?: number;
    updatedReplicas?: number;
    availableReplicas?: number;
    conditions?: K8sCondition[];
  };
}

export interface K8sReplicaSet {
  metadata?: K8sMeta;
  spec?: { replicas?: number; template?: { spec?: { containers?: { image?: string }[] } } };
  status?: { replicas?: number; readyReplicas?: number; availableReplicas?: number };
}

export interface K8sContainerState {
  waiting?: { reason?: string; message?: string };
  terminated?: { reason?: string; exitCode?: number; message?: string };
}

export interface K8sPod {
  metadata?: K8sMeta;
  spec?: { containers?: { name?: string; image?: string }[] };
  status?: {
    phase?: string;
    containerStatuses?: {
      name?: string;
      ready?: boolean;
      restartCount?: number;
      image?: string;
      state?: K8sContainerState;
      lastState?: K8sContainerState;
    }[];
  };
}

export interface K8sService {
  metadata?: K8sMeta;
  spec?: { ports?: { name?: string; port?: number; protocol?: string }[] };
}

export interface K8sEndpointSlice {
  metadata?: K8sMeta;
  endpoints?: { conditions?: { ready?: boolean } }[];
}

export interface K8sCondition {
  type?: string;
  status?: string;
  reason?: string;
  message?: string;
  lastUpdateTime?: Timestamp;
}

export interface K8sExternalSecret {
  metadata?: K8sMeta;
  spec?: {
    data?: { remoteRef?: { key?: string } }[];
    dataFrom?: { extract?: { key?: string } }[];
  };
  status?: { refreshTime?: string; conditions?: K8sCondition[] };
}

export interface K8sEvent {
  type?: string;
  reason?: string;
  message?: string;
  count?: number;
  lastTimestamp?: Timestamp;
  eventTime?: Timestamp;
  series?: { count?: number; lastObservedTime?: Timestamp };
  involvedObject?: { kind?: string; name?: string; namespace?: string };
}

export interface ReleaseForSummary {
  name: string;
  namespace: string;
  version: string;
  bindings: Record<string, { enabled?: boolean; ref?: string } | undefined>;
  ready: K8sCondition | null;
}

export interface EnvironmentObjects {
  // The workload cluster the objects below were read from. reachable=false
  // means they are empty because they couldn't be read, not because there
  // are none.
  cluster: { name: string | null; reachable: boolean };
  release: ReleaseForSummary | null;
  deployments: K8sDeployment[];
  replicaSets: K8sReplicaSet[];
  pods: K8sPod[];
  services: K8sService[];
  // keyed by "<namespace>/<service name>"
  endpointSlices: Record<string, K8sEndpointSlice[]>;
  externalSecrets: K8sExternalSecret[];
  events: K8sEvent[];
}

// --- output shape ---------------------------------------------------------

export interface PodSummary {
  name: string;
  namespace: string;
  phase: string;
  ready: boolean;
  restarts: number;
  createdAt: string | null;
  images: string[];
  // Owning ReplicaSet (owner reference), i.e. which revision the pod is.
  replicaSet: string | null;
  // Why a pod isn't healthy, in the terms a developer searches for. `kind`
  // is the stable class; the raw reasons flap (ErrImagePull <->
  // ImagePullBackOff, RunContainerError <-> CrashLoopBackOff).
  problem: { kind: PodProblemKind; state: 'waiting' | 'terminated'; reason: string; exitCode?: number } | null;
}

export interface BindingSummary {
  name: string;
  declaredByRelease: boolean;
  providerRef: { kind: string; name: string; namespace: string } | null;
  mountPath: string;
  externalSecret: {
    name: string;
    namespace: string;
    ready: boolean | null;
    reason: string | null;
    message?: string | null; // owner only
    refreshTime: string | null;
    remoteKey: string | null; // a Secrets Manager PATH, never a value
  } | null;
  problem: string | null;
}

export interface WarningSummary {
  reason: string;
  objectKind: string;
  objectName: string;
  count: number;
  lastSeen: string | null;
  message?: string; // owner only
}

export interface EnvironmentSummary {
  component: string;
  environment: string;
  detailLevel: 'owner' | 'summary';
  cluster: { name: string | null; reachable: boolean };
  progress: DeploymentProgress;
  release: {
    name: string;
    namespace: string;
    version: string;
    ready: boolean | null;
    reason: string | null;
  } | null;
  workload: {
    desiredReplicas: number;
    readyReplicas: number;
    pods: PodSummary[];
    runningImageTags: string[];
    // null when there is nothing to compare (no Release or no pods)
    imageMatchesRelease: boolean | null;
    deployment: DeploymentRollout | null;
    replicaSets: ReplicaSetSummary[]; // newest revision first, old ones kept at 0
  };
  networking: {
    services: {
      name: string;
      namespace: string;
      ports: { name: string | null; port: number; protocol: string }[];
      readyEndpoints: number;
      notReadyEndpoints: number;
    }[];
  };
  bindings: BindingSummary[];
  warnings: WarningSummary[];
}

// --- logic ----------------------------------------------------------------

export const BINDING_LABEL = 'platform.taskapp.io/binding';
export const BINDING_ROOT = '/bindings';
export const WARNING_WINDOW_MS = 60 * 60 * 1000;

// Binding name -> the platform CR kind that provides it. Unknown binding
// types still get listed (with no provider link), never dropped.
const BINDING_PROVIDER_KINDS: Record<string, string> = {
  database: 'Database',
};

export function imageTag(image: string): string {
  const withoutDigest = image.split('@')[0];
  const lastSlash = withoutDigest.lastIndexOf('/');
  const lastColon = withoutDigest.lastIndexOf(':');
  return lastColon > lastSlash ? withoutDigest.slice(lastColon + 1) : 'latest';
}

const PROBLEM_KINDS: Record<string, PodProblemKind> = {
  ErrImagePull: 'ImagePull',
  ImagePullBackOff: 'ImagePull',
  InvalidImageName: 'ImagePull',
  CrashLoopBackOff: 'CrashLoop',
  RunContainerError: 'CrashLoop',
};

export function problemKind(reason: string): PodProblemKind {
  return PROBLEM_KINDS[reason] ?? 'Other';
}

function podProblem(pod: K8sPod): PodSummary['problem'] {
  for (const status of pod.status?.containerStatuses ?? []) {
    const waiting = status.state?.waiting;
    if (waiting?.reason && waiting.reason !== 'ContainerCreating') {
      const kind = problemKind(waiting.reason);
      const last = status.lastState?.terminated;
      // CrashLoopBackOff alone isn't actionable — surface why it crashed.
      if (last?.reason) {
        return { kind, state: 'terminated', reason: `${waiting.reason} (last exit: ${last.reason})`, exitCode: last.exitCode };
      }
      return { kind, state: 'waiting', reason: waiting.reason };
    }
    const terminated = status.state?.terminated;
    if (terminated?.reason && terminated.reason !== 'Completed') {
      // A Deployment's container that exited gets restarted: a crash loop.
      return { kind: 'CrashLoop', state: 'terminated', reason: terminated.reason, exitCode: terminated.exitCode };
    }
  }
  return null;
}

function toPodSummary(pod: K8sPod): PodSummary | null {
  const name = pod.metadata?.name;
  const namespace = pod.metadata?.namespace;
  if (!name || !namespace) {
    return null;
  }
  const statuses = pod.status?.containerStatuses ?? [];
  const images = (pod.spec?.containers ?? [])
    .map(c => c.image)
    .filter((i): i is string => Boolean(i));
  return {
    name,
    namespace,
    phase: pod.status?.phase ?? 'Unknown',
    ready: statuses.length > 0 && statuses.every(s => s.ready === true),
    restarts: statuses.reduce((sum, s) => sum + (s.restartCount ?? 0), 0),
    createdAt: iso(pod.metadata?.creationTimestamp),
    images,
    replicaSet: pod.metadata?.ownerReferences?.find(o => o.kind === 'ReplicaSet')?.name ?? null,
    problem: podProblem(pod),
  };
}

function toReplicaSetSummary(rs: K8sReplicaSet): ReplicaSetSummary | null {
  const name = rs.metadata?.name;
  const namespace = rs.metadata?.namespace;
  if (!name || !namespace) {
    return null;
  }
  const revision = Number(rs.metadata?.annotations?.['deployment.kubernetes.io/revision']);
  const image = rs.spec?.template?.spec?.containers?.[0]?.image;
  return {
    name,
    namespace,
    revision: Number.isFinite(revision) ? revision : null,
    version: image ? imageTag(image) : null,
    desired: rs.spec?.replicas ?? 0,
    current: rs.status?.replicas ?? 0,
    ready: rs.status?.readyReplicas ?? 0,
    available: rs.status?.availableReplicas ?? 0,
    createdAt: iso(rs.metadata?.creationTimestamp),
  };
}

function toDeploymentRollout(d: K8sDeployment): DeploymentRollout {
  const progressing = (d.status?.conditions ?? []).find(c => c.type === 'Progressing');
  return {
    generation: d.metadata?.generation ?? null,
    observedGeneration: d.status?.observedGeneration ?? null,
    replicas: d.spec?.replicas ?? 0,
    deadlineExceeded: progressing?.status === 'False' && progressing.reason === 'ProgressDeadlineExceeded',
    completedAt:
      progressing?.status === 'True' && progressing.reason === 'NewReplicaSetAvailable'
        ? iso(progressing.lastUpdateTime)
        : null,
  };
}

function externalSecretKey(es: K8sExternalSecret): string | null {
  return (
    es.spec?.dataFrom?.find(d => d.extract?.key)?.extract?.key ??
    es.spec?.data?.find(d => d.remoteRef?.key)?.remoteRef?.key ??
    null
  );
}

function buildBindings(
  release: ReleaseForSummary | null,
  externalSecrets: K8sExternalSecret[],
  includeSensitive: boolean,
): BindingSummary[] {
  const byName = new Map<string, BindingSummary>();

  for (const [name, binding] of Object.entries(release?.bindings ?? {})) {
    if (!binding?.enabled) {
      continue;
    }
    const providerKind = BINDING_PROVIDER_KINDS[name];
    byName.set(name, {
      name,
      declaredByRelease: true,
      providerRef:
        providerKind && binding.ref && release
          ? { kind: providerKind, name: binding.ref, namespace: release.namespace }
          : null,
      mountPath: `${BINDING_ROOT}/${name}`,
      externalSecret: null,
      problem: null,
    });
  }

  for (const es of externalSecrets) {
    const name = es.metadata?.labels?.[BINDING_LABEL];
    if (!name || !es.metadata?.name || !es.metadata.namespace) {
      continue;
    }
    const ready = (es.status?.conditions ?? []).find(c => c.type === 'Ready');
    const entry: BindingSummary = byName.get(name) ?? {
      name,
      declaredByRelease: false,
      providerRef: null,
      mountPath: `${BINDING_ROOT}/${name}`,
      externalSecret: null,
      problem: null,
    };
    entry.externalSecret = {
      name: es.metadata.name,
      namespace: es.metadata.namespace,
      ready: ready ? ready.status === 'True' : null,
      reason: ready?.reason ?? null,
      ...(includeSensitive ? { message: ready?.message ?? null } : {}),
      refreshTime: es.status?.refreshTime ?? null,
      remoteKey: externalSecretKey(es),
    };
    byName.set(name, entry);
  }

  for (const entry of byName.values()) {
    if (entry.declaredByRelease && !entry.externalSecret) {
      entry.problem =
        'Declared on the Release, but no ExternalSecret materialises it yet (still rolling out, or the chart predates binding labels).';
    } else if (entry.externalSecret && entry.externalSecret.ready !== true) {
      entry.problem = `Credentials not synced from Secrets Manager${entry.externalSecret.reason ? ` (${entry.externalSecret.reason})` : ''}.`;
    } else if (!entry.declaredByRelease) {
      entry.problem = 'An ExternalSecret exists for this binding, but the Release no longer declares it.';
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function eventTime(e: K8sEvent): string | null {
  return iso(e.series?.lastObservedTime ?? e.lastTimestamp ?? e.eventTime);
}

function buildWarnings(
  objects: EnvironmentObjects,
  now: Date,
  includeSensitive: boolean,
): WarningSummary[] {
  // Only events about this component's own objects.
  const owned = new Set<string>();
  const add = (kind: string, namespace?: string, name?: string) => {
    if (namespace && name) owned.add(`${kind}/${namespace}/${name}`);
  };
  objects.deployments.forEach(d => add('Deployment', d.metadata?.namespace, d.metadata?.name));
  objects.replicaSets.forEach(r => add('ReplicaSet', r.metadata?.namespace, r.metadata?.name));
  objects.pods.forEach(p => add('Pod', p.metadata?.namespace, p.metadata?.name));
  objects.externalSecrets.forEach(e => add('ExternalSecret', e.metadata?.namespace, e.metadata?.name));

  const since = now.getTime() - WARNING_WINDOW_MS;
  const grouped = new Map<string, WarningSummary>();

  for (const e of objects.events) {
    const obj = e.involvedObject;
    if (e.type !== 'Warning' || !obj?.kind || !obj.name) continue;
    if (!owned.has(`${obj.kind}/${obj.namespace}/${obj.name}`)) continue;
    const at = eventTime(e);
    if (at && new Date(at).getTime() < since) continue;

    const key = `${e.reason}/${obj.kind}/${obj.name}`;
    const count = e.series?.count ?? e.count ?? 1;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += count;
      if (at && (!existing.lastSeen || at > existing.lastSeen)) {
        existing.lastSeen = at;
        if (includeSensitive) existing.message = e.message ?? '';
      }
    } else {
      grouped.set(key, {
        reason: e.reason ?? 'Unknown',
        objectKind: obj.kind,
        objectName: obj.name,
        count,
        lastSeen: at,
        ...(includeSensitive ? { message: e.message ?? '' } : {}),
      });
    }
  }

  return [...grouped.values()].sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
}

export function buildEnvironmentSummary(
  component: string,
  environment: string,
  objects: EnvironmentObjects,
  options: { includeSensitive: boolean; now?: Date },
): EnvironmentSummary {
  const { includeSensitive } = options;
  const now = options.now ?? new Date();

  const pods = objects.pods
    .map(toPodSummary)
    .filter((p): p is PodSummary => p !== null)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const runningImageTags = [...new Set(pods.flatMap(p => p.images).map(imageTag))].sort();
  const release = objects.release;

  // The golang-service chart renders one Deployment per component; rollout
  // state follows it and only the ReplicaSets it owns.
  const deployment = objects.deployments[0];
  const rollout = deployment ? toDeploymentRollout(deployment) : null;
  const replicaSets = objects.replicaSets
    .filter(rs => rs.metadata?.ownerReferences?.some(o => o.kind === 'Deployment' && o.name === deployment?.metadata?.name))
    .map(toReplicaSetSummary)
    .filter((r): r is ReplicaSetSummary => r !== null)
    .sort(byRevisionDesc);

  return {
    component,
    environment,
    detailLevel: includeSensitive ? 'owner' : 'summary',
    cluster: objects.cluster,
    progress: deriveProgress({
      reachable: objects.cluster.reachable,
      targetVersion: release?.version || null,
      deployment: rollout,
      replicaSets,
      pods,
    }),
    release: release
      ? {
          name: release.name,
          namespace: release.namespace,
          version: release.version,
          ready: release.ready ? release.ready.status === 'True' : null,
          reason: release.ready?.reason ?? null,
        }
      : null,
    workload: {
      desiredReplicas: objects.deployments.reduce((n, d) => n + (d.spec?.replicas ?? 0), 0),
      readyReplicas: objects.deployments.reduce((n, d) => n + (d.status?.readyReplicas ?? 0), 0),
      pods,
      runningImageTags,
      imageMatchesRelease:
        release && runningImageTags.length > 0
          ? runningImageTags.every(tag => tag === release.version)
          : null,
      deployment: rollout,
      replicaSets,
    },
    networking: {
      services: objects.services
        .filter(s => s.metadata?.name && s.metadata.namespace)
        .map(s => {
          const slices = objects.endpointSlices[`${s.metadata!.namespace}/${s.metadata!.name}`] ?? [];
          const endpoints = slices.flatMap(sl => sl.endpoints ?? []);
          const ready = endpoints.filter(ep => ep.conditions?.ready !== false).length;
          return {
            name: s.metadata!.name!,
            namespace: s.metadata!.namespace!,
            ports: (s.spec?.ports ?? [])
              .filter(p => typeof p.port === 'number')
              .map(p => ({ name: p.name ?? null, port: p.port!, protocol: p.protocol ?? 'TCP' })),
            readyEndpoints: ready,
            notReadyEndpoints: endpoints.length - ready,
          };
        }),
    },
    bindings: buildBindings(release, objects.externalSecrets, includeSensitive),
    warnings: buildWarnings(objects, now, includeSensitive),
  };
}
