import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { accentGradient, environmentAccent } from '../platformUi/environmentAccent';

// Environments come from one list in app-config (platform.environments),
// not an enum in the template — adding a cluster is a config change only.
export const EnvironmentPicker = ({
  formData,
  onChange,
  required,
  rawErrors,
  schema,
}: FieldExtensionComponentProps<string>) => {
  const environments =
    useApi(configApiRef).getOptionalStringArray('platform.environments') ?? [];

  return (
    <FormControl
      fullWidth
      margin="normal"
      required={required}
      error={!!rawErrors?.length}
      disabled={environments.length === 0}
    >
      <InputLabel id="environment-picker-label">{schema.title ?? 'Environment'}</InputLabel>
      <Select
        labelId="environment-picker-label"
        value={formData ?? ''}
        onChange={e => onChange(e.target.value as string)}
      >
        {environments.map(env => (
          <MenuItem key={env} value={env}>
            {/* The environment's own colour, as on its cards and chips. */}
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                marginRight: 10,
                display: 'inline-block',
                background: accentGradient(environmentAccent(env)),
              }}
            />
            {env}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>
        {environments.length === 0
          ? 'No environments configured (platform.environments in app-config).'
          : schema.description}
      </FormHelperText>
    </FormControl>
  );
};
