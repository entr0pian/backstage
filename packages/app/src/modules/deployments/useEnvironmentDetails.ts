import { useCallback, useEffect, useState } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';

// Mirrors the backend's DeploymentProgress
// (packages/backend/src/modules/environmentSummary/DeploymentProgress.ts):
// where the environment's rollout is, derived server-side.
export type PodProblemKind = 'ImagePull' | 'CrashLoop' | 'Other';
export type ProgressPhase = 'Pending' | 'RollingOut' | 'Stalled' | 'RolloutFailed' | 'Healthy' | 'Unknown';

export interface DeploymentProgress {
  phase: ProgressPhase;
  targetVersion: string | null;
  desiredReplicas: number;
  target: { revision: number | null; version: string | null; ready: number; available: number } | null;
  previous: { revision: number | null; version: string | null; current: number; ready: number } | null;
  problems: { pod: string; kind: PodProblemKind; reason: string }[];
  startedAt: string | null; // the rollout to the target revision began
  completedAt: string | null; // ...and finished (set once Healthy)
}

// Mirrors the backend's EnvironmentSummary
// (packages/backend/src/modules/environmentSummary/EnvironmentSummary.ts).
// Optional `message` fields are only present when the caller is the owner —
// the backend redacts them for guests (BACKSTAGE_PART9.md "Guest vs owner").
export interface EnvironmentDetails {
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
    pods: {
      name: string;
      namespace: string;
      phase: string;
      ready: boolean;
      restarts: number;
      createdAt: string | null;
      images: string[];
      replicaSet: string | null;
      problem: { kind: PodProblemKind; state: 'waiting' | 'terminated'; reason: string; exitCode?: number } | null;
    }[];
    runningImageTags: string[];
    imageMatchesRelease: boolean | null;
    deployment: {
      name: string;
      createdAt: string | null;
      generation: number | null;
      observedGeneration: number | null;
      replicas: number;
      deadlineExceeded: boolean;
      completedAt: string | null;
    } | null;
    replicaSets: {
      name: string;
      namespace: string;
      revision: number | null;
      version: string | null;
      desired: number;
      current: number;
      ready: number;
      available: number;
      createdAt: string | null;
    }[];
  };
  networking: {
    services: {
      name: string;
      namespace: string;
      ports: { name: string | null; port: number; protocol: string }[];
      readyEndpoints: number;
      notReadyEndpoints: number;
      createdAt: string | null;
    }[];
  };
  bindings: {
    name: string;
    declaredByRelease: boolean;
    providerRef: { kind: string; name: string; namespace: string } | null;
    mountPath: string;
    externalSecret: {
      name: string;
      namespace: string;
      ready: boolean | null;
      reason: string | null;
      message?: string | null;
      refreshTime: string | null;
      remoteKey: string | null;
    } | null;
    problem: string | null;
  }[];
  warnings: {
    reason: string;
    objectKind: string;
    objectName: string;
    count: number;
    lastSeen: string | null;
    message?: string;
  }[];
}

export type EnvironmentDetailsState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'done'; details: EnvironmentDetails };

// Loads one environment's Details from our own platform backend route —
// already joined and redacted server-side; nothing here talks to
// Kubernetes directly. Only fetches while the drawer is open; `reload`
// re-fetches on demand.
export function useEnvironmentDetails(
  component: string,
  environment: string | null,
): EnvironmentDetailsState & { reload: () => void } {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [state, setState] = useState<EnvironmentDetailsState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!environment) {
      return undefined;
    }
    let cancelled = false;

    (async () => {
      setState({ status: 'loading' });
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(
          `${baseUrl}/environments/${encodeURIComponent(component)}/${encodeURIComponent(environment)}`,
        );
        if (!res.ok) {
          throw new Error(`Environment details request failed: ${res.status} ${res.statusText}`);
        }
        const details: EnvironmentDetails = await res.json();
        if (!cancelled) {
          setState({ status: 'done', details });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', error: error as Error });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi, component, environment, nonce]);

  return { ...state, reload };
}
