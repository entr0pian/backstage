import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { FormFieldBlueprint } from '@backstage/plugin-scaffolder-react/alpha';

// Custom scaffolder form field for the Onboard Service template. A module
// of the scaffolder plugin, like createDeployment's pickers.
const scaffoldVersionPicker = FormFieldBlueprint.make({
  name: 'platform-scaffold-version-picker',
  params: { field: () => import('./fields').then(m => m.scaffoldVersionPickerField) },
});

export const onboardServiceModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [scaffoldVersionPicker],
});
