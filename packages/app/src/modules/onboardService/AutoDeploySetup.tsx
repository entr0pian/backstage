import { useEffect } from 'react';
import Checkbox from '@material-ui/core/Checkbox';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { DEFAULT_AUTO_DEPLOY_ENVIRONMENTS } from '../createDeployment/autoDeploy';

export interface AutoDeploySetupValue {
  enabled?: boolean;
  environment?: string;
}

// Whether the onboarding PR also adds a Release that follows main, and in
// which environment: the first of platform.autoDeployEnvironments (the
// environments release-operator auto-deploys in), not a hardcoded "dev".
// On by default; off and greyed out when no environment allows it.
export const AutoDeploySetup = ({
  formData,
  onChange,
  schema,
}: FieldExtensionComponentProps<AutoDeploySetupValue>) => {
  const environment: string | undefined = (
    useApi(configApiRef).getOptionalStringArray('platform.autoDeployEnvironments') ??
    DEFAULT_AUTO_DEPLOY_ENVIRONMENTS
  )[0];
  const enabled = Boolean(environment) && (formData?.enabled ?? true);

  // Keep the submitted value complete: the template reads both fields.
  useEffect(() => {
    if (formData?.enabled !== enabled || formData?.environment !== environment) {
      onChange({ enabled, environment });
    }
  }, [enabled, environment, formData, onChange]);

  return (
    <FormControl fullWidth margin="normal">
      <FormControlLabel
        control={
          <Checkbox
            color="primary"
            checked={enabled}
            disabled={!environment}
            onChange={e => onChange({ enabled: e.target.checked, environment })}
          />
        }
        label={environment ? `Set up auto deployment to ${environment}` : schema.title ?? 'Auto deployment'}
      />
      <FormHelperText>
        {environment
          ? schema.description
          : 'No environment allows auto-deploy (platform.autoDeployEnvironments is empty).'}
      </FormHelperText>
    </FormControl>
  );
};
