import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

// Where a Release may turn on auto-deploy — app-config
// platform.autoDeployEnvironments, "dev" when unset. release-operator
// enforces the same list (--auto-deploy-environments), so this only decides
// what the form offers; a hand-written Release elsewhere is still refused.
export const DEFAULT_AUTO_DEPLOY_ENVIRONMENTS = ['dev'];

export function autoDeployAllowed(environment: string | undefined, allowed: string[]): boolean {
  return Boolean(environment) && allowed.includes(environment!);
}

// Mirrors the backend's CommittedRelease (modules/releaseVersions).
export interface CommittedRelease {
  exists: boolean;
  autoDeploy: boolean;
  version: string | null;
  bindings: Record<string, string>;
}

// GET /api/platform/committed-releases/:component/:environment — the
// Release as committed on application-repositories' main. Shared by the
// toggle (its starting value) and its validation (submit is blocked when
// this can't be read, see AutoDeployToggle.tsx).
export async function fetchCommittedRelease(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
  component: string,
  environment: string,
): Promise<CommittedRelease> {
  const baseUrl = await discoveryApi.getBaseUrl('platform');
  const res = await fetchApi.fetch(
    `${baseUrl}/committed-releases/${encodeURIComponent(component)}/${encodeURIComponent(environment)}`,
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  }
  return body;
}
