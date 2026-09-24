// Pure logic for the Deployments tab's Logs dialog: which pods belong to one
// component in one environment, and how to present them. Pods are found by
// the platform.taskapp.io/{component,environment} label contract the
// scaffolded chart stamps on every workload (BACKSTAGE_PART8.md) — the same
// contract joinDeployments.ts uses for Argo CD Applications — never by
// namespace or name. No I/O here; the fetch lives in useWorkloadPods.ts.

const COMPONENT_LABEL = 'platform.taskapp.io/component';
const ENVIRONMENT_LABEL = 'platform.taskapp.io/environment';

export function workloadPodSelector(component: string, environment: string): string {
  return `${COMPONENT_LABEL}=${component},${ENVIRONMENT_LABEL}=${environment}`;
}

// Subset of a Kubernetes Pod — only the fields read here.
export interface KubernetesPod {
  metadata?: {
    name?: string;
    namespace?: string;
    creationTimestamp?: string;
  };
  spec?: {
    containers?: { name?: string }[];
  };
  status?: {
    phase?: string;
    containerStatuses?: { name?: string; ready?: boolean; restartCount?: number }[];
  };
}

export interface WorkloadPod {
  clusterName: string;
  name: string;
  namespace: string;
  phase: string;
  ready: boolean;
  restarts: number;
  containers: string[];
  createdAt: string | null;
}

export function toWorkloadPods(clusterName: string, pods: KubernetesPod[]): WorkloadPod[] {
  const result: WorkloadPod[] = [];
  for (const pod of pods) {
    const name = pod.metadata?.name;
    const namespace = pod.metadata?.namespace;
    if (!name || !namespace) {
      continue;
    }
    const statuses = pod.status?.containerStatuses ?? [];
    result.push({
      clusterName,
      name,
      namespace,
      phase: pod.status?.phase ?? 'Unknown',
      ready: statuses.length > 0 && statuses.every(s => s.ready === true),
      restarts: statuses.reduce((sum, s) => sum + (s.restartCount ?? 0), 0),
      containers: (pod.spec?.containers ?? [])
        .map(c => c.name)
        .filter((n): n is string => Boolean(n)),
      createdAt: pod.metadata?.creationTimestamp ?? null,
    });
  }
  return result;
}

// Ready pods first, then newest first — so the default selection is the pod
// most likely to have the logs a developer is after.
export function sortWorkloadPods(pods: WorkloadPod[]): WorkloadPod[] {
  return [...pods].sort((a, b) => {
    if (a.ready !== b.ready) {
      return a.ready ? -1 : 1;
    }
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}
