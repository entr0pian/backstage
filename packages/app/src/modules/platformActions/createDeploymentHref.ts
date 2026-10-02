// Same formData forwarding as addDatabaseHref — the Create deployment
// template (templates/create-deployment) starts with the component filled in,
// and optionally more: a roll back pre-fills the environment, the previous
// version and the Release's current bindings, so it goes through the same
// PR -> Release -> Argo CD path as any deploy and keeps what's bound.
export interface CreateDeploymentPrefill {
  environment?: string;
  version?: string;
  bindings?: Record<string, string>;
}

export function createDeploymentHref(componentName: string, prefill: CreateDeploymentPrefill = {}): string {
  const formData = JSON.stringify({ componentName, ...prefill });
  return `/create/templates/default/create-deployment?formData=${encodeURIComponent(formData)}`;
}
