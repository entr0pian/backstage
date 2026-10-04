import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import { ScaffoldVersionPicker } from './ScaffoldVersionPicker';
import { AutoDeploySetup } from './AutoDeploySetup';

// `ui:field` names used by templates/onboard-service/template.yaml.
export const scaffoldVersionPickerField = createFormField({
  name: 'PlatformScaffoldVersionPicker',
  component: ScaffoldVersionPicker,
});

export const autoDeploySetupField = createFormField({
  name: 'PlatformAutoDeploySetup',
  component: AutoDeploySetup,
});
