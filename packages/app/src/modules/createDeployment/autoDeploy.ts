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
