// Same formData forwarding as addDatabaseHref — the Create deployment
// template (templates/create-deployment) starts with the component filled in.
export function createDeploymentHref(componentName: string): string {
  const formData = JSON.stringify({ componentName });
  return `/create/templates/default/create-deployment?formData=${encodeURIComponent(formData)}`;
}
