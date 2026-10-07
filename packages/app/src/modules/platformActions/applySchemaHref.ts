// Opens the Apply database schema template (templates/apply-schema) with the
// component, and optionally the environment, already filled in, through the
// scaffolder's `formData` query param (see addDatabaseHref).
export function applySchemaHref(componentName: string, environment?: string): string {
  const formData = JSON.stringify(environment ? { componentName, environment } : { componentName });
  return `/create/templates/default/apply-schema?formData=${encodeURIComponent(formData)}`;
}
