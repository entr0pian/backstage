// Pure join logic: Release-version data (our own backend) + Argo CD
// Application data (the installed Argo CD plugin's own backend), correlated
// by (component, environment) using the platform.taskapp.io/* label
// contract — never by Application name. See platform-architecture's
// BACKSTAGE_PART6.md "Deployment correlation" section. No I/O here; the
// two fetches live in DeploymentsCard.tsx.

export interface ReleaseVersion {
  environment: string;
  version: string;
}

// Subset of ArgoCD's Application resource shape that argocd-backend's
// listArgoApps returns — only the fields this join actually reads.
export interface ArgoApplication {
  metadata?: {
    name?: string;
    labels?: Record<string, string>;
  };
  status?: {
    sync?: { status?: string };
    health?: { status?: string };
  };
}

export interface Deployment {
  environment: string;
  version: string | null;
  syncStatus: string;
  healthStatus: string;
}

const ENVIRONMENT_LABEL = 'platform.taskapp.io/environment';

export function joinDeployments(
  releases: ReleaseVersion[],
  argoApps: ArgoApplication[],
): Deployment[] {
  const byEnvironment = new Map<string, Deployment>();

  for (const release of releases) {
    byEnvironment.set(release.environment, {
      environment: release.environment,
      version: release.version,
      syncStatus: 'Unknown',
      healthStatus: 'Unknown',
    });
  }

  for (const app of argoApps) {
    const environment = app.metadata?.labels?.[ENVIRONMENT_LABEL];
    if (!environment) {
      continue;
    }
    const existing = byEnvironment.get(environment);
    const syncStatus = app.status?.sync?.status ?? 'Unknown';
    const healthStatus = app.status?.health?.status ?? 'Unknown';
    if (existing) {
      existing.syncStatus = syncStatus;
      existing.healthStatus = healthStatus;
    } else {
      // Argo Application exists but no matching Release — surface it
      // rather than hiding it, same reasoning as BACKSTAGE_PART5.md's
      // missing-state philosophy: a transient GitOps-reconciling gap is
      // useful platform information, not noise.
      byEnvironment.set(environment, {
        environment,
        version: null,
        syncStatus,
        healthStatus,
      });
    }
  }

  return [...byEnvironment.values()].sort((a, b) =>
    a.environment.localeCompare(b.environment),
  );
}
