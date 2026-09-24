// Pure join logic: Release-version data (our own backend) + Argo CD
// Application data (the installed Argo CD plugin's own backend), correlated
// by (component, environment) using the platform.taskapp.io/* label
// contract — never by Application name. See platform-architecture's
// BACKSTAGE_PART6.md "Deployment correlation" section. No I/O here; the
// two fetches live in useDeployments.ts.
//
// Release defines which environments exist (intent); Argo CD only enriches
// them with delivery state — see BACKSTAGE_PART7.md. Changing the Argo
// Application naming convention never touches this file, since nothing
// here reads an Application's name to decide what it belongs to.

export interface ReleaseVersion {
  environment: string;
  version: string;
  releaseName: string;
}

// Subset of ArgoCD's Application resource shape that argocd-backend's
// listArgoApps returns — only the fields this join actually reads.
export interface ArgoApplication {
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: {
    destination?: { namespace?: string; server?: string };
  };
  status?: {
    sync?: { status?: string; revision?: string };
    health?: { status?: string };
    history?: { deployedAt?: string; revision?: string }[];
    operationState?: { finishedAt?: string };
  };
}

export interface Deployment {
  environment: string;
  // null: an Argo Application exists with no matching Release.
  version: string | null;
  releaseName: string | null;
  // null: a Release exists but Argo CD has no Application for it (yet).
  argoApplicationName: string | null;
  argoApplicationNamespace: string | null;
  syncStatus: string;
  healthStatus: string;
  revision: string | null;
  lastDeployed: string | null;
  namespace: string | null;
  server: string | null;
}

const ENVIRONMENT_LABEL = 'platform.taskapp.io/environment';

function emptyDelivery(): Pick<
  Deployment,
  | 'argoApplicationName'
  | 'argoApplicationNamespace'
  | 'syncStatus'
  | 'healthStatus'
  | 'revision'
  | 'lastDeployed'
  | 'namespace'
  | 'server'
> {
  return {
    argoApplicationName: null,
    argoApplicationNamespace: null,
    syncStatus: 'Unknown',
    healthStatus: 'Unknown',
    revision: null,
    lastDeployed: null,
    namespace: null,
    server: null,
  };
}

function deliveryFrom(app: ArgoApplication): ReturnType<typeof emptyDelivery> {
  const history = app.status?.history ?? [];
  const latest = history[history.length - 1];
  return {
    argoApplicationName: app.metadata?.name ?? null,
    argoApplicationNamespace: app.metadata?.namespace ?? null,
    syncStatus: app.status?.sync?.status ?? 'Unknown',
    healthStatus: app.status?.health?.status ?? 'Unknown',
    revision: app.status?.sync?.revision ?? latest?.revision ?? null,
    lastDeployed:
      latest?.deployedAt ?? app.status?.operationState?.finishedAt ?? null,
    namespace: app.spec?.destination?.namespace ?? null,
    server: app.spec?.destination?.server ?? null,
  };
}

export function joinDeployments(
  releases: ReleaseVersion[],
  argoApps: ArgoApplication[],
): Deployment[] {
  const byEnvironment = new Map<string, Deployment>();

  for (const release of releases) {
    byEnvironment.set(release.environment, {
      environment: release.environment,
      version: release.version,
      releaseName: release.releaseName,
      ...emptyDelivery(),
    });
  }

  for (const app of argoApps) {
    const environment = app.metadata?.labels?.[ENVIRONMENT_LABEL];
    if (!environment) {
      continue;
    }
    const existing = byEnvironment.get(environment);
    if (existing) {
      Object.assign(existing, deliveryFrom(app));
    } else {
      // Argo Application exists but no matching Release — surface it
      // rather than hiding it, same reasoning as BACKSTAGE_PART5.md's
      // missing-state philosophy: a transient GitOps-reconciling gap is
      // useful platform information, not noise.
      byEnvironment.set(environment, {
        environment,
        version: null,
        releaseName: null,
        ...deliveryFrom(app),
      });
    }
  }

  return [...byEnvironment.values()].sort((a, b) =>
    a.environment.localeCompare(b.environment),
  );
}

// Deep link into the Argo CD UI for one Application. uiUrl is the
// browser-reachable Argo CD address (extension config), not the in-cluster
// URL argocd-backend talks to.
export function argoApplicationUrl(
  uiUrl: string | undefined,
  deployment: Pick<Deployment, 'argoApplicationName' | 'argoApplicationNamespace'>,
): string | null {
  if (!uiUrl || !deployment.argoApplicationName) {
    return null;
  }
  const base = uiUrl.replace(/\/+$/, '');
  const namespace = deployment.argoApplicationNamespace ?? 'argocd';
  return `${base}/applications/${encodeURIComponent(namespace)}/${encodeURIComponent(deployment.argoApplicationName)}`;
}
