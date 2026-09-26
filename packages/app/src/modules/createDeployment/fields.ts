import { createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import { EnvironmentPicker } from './EnvironmentPicker';
import { VersionPicker } from './VersionPicker';
import { DependencyBindingsPicker } from './DependencyBindingsPicker';

// `ui:field` names used by templates/create-deployment/template.yaml.
export const environmentPickerField = createFormField({
  name: 'PlatformEnvironmentPicker',
  component: EnvironmentPicker,
});

export const versionPickerField = createFormField({
  name: 'PlatformVersionPicker',
  component: VersionPicker,
});

export const dependencyBindingsPickerField = createFormField({
  name: 'PlatformDependencyBindingsPicker',
  component: DependencyBindingsPicker,
});
