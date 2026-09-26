// The scaffolder's template page reads its initial form state from a
// `formData` query param (@backstage/plugin-scaffolder-react's
// useFormDataFromQuery) — this is how componentName gets forwarded from the
// Catalog entity page without the user re-entering it. See
// BACKSTAGE_PART3.md §11 in platform-architecture. `environment` is
// optional — Create deployment's dependency picker pre-fills it.
export function addDatabaseHref(componentName: string, environment?: string): string {
  const formData = JSON.stringify(environment ? { componentName, environment } : { componentName });
  return `/create/templates/default/add-database?formData=${encodeURIComponent(formData)}`;
}
