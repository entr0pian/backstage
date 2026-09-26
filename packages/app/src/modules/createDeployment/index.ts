import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';

// Custom scaffolder form fields for the Create deployment template
// (platform-architecture DEPLOYMENTS.md Step 1). A module of the scaffolder
// plugin, since its template page is what collects FormFieldBlueprints.
const environmentPicker = FormFieldBlueprint.make({
  name: 'platform-environment-picker',
  params: { field: () => import('./fields').then(m => m.environmentPickerField) },
});

const versionPicker = FormFieldBlueprint.make({
  name: 'platform-version-picker',
  params: { field: () => import('./fields').then(m => m.versionPickerField) },
});

const dependencyBindingsPicker = FormFieldBlueprint.make({
  name: 'platform-dependency-bindings-picker',
  params: { field: () => import('./fields').then(m => m.dependencyBindingsPickerField) },
});

export const createDeploymentModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [environmentPicker, versionPicker, dependencyBindingsPicker],
});
