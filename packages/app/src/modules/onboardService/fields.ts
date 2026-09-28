import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import { ScaffoldVersionPicker } from './ScaffoldVersionPicker';

// `ui:field` name used by templates/onboard-service/template.yaml.
export const scaffoldVersionPickerField = createFormField({
  name: 'PlatformScaffoldVersionPicker',
  component: ScaffoldVersionPicker,
});
