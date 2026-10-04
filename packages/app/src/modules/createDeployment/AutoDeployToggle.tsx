import { useEffect, useState } from 'react';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import Switch from '@material-ui/core/Switch';
import {
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import type {
  CustomFieldValidator,
  FieldExtensionComponentProps,
} from '@backstage/plugin-scaffolder-react';
import {
  DEFAULT_AUTO_DEPLOY_ENVIRONMENTS,
  autoDeployAllowed,
  fetchCommittedRelease,
  type CommittedRelease,
} from './autoDeploy';

type CommittedState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; key: string; release: CommittedRelease };

// Whether the Release follows main (every successful CI build deploys on
// its own) instead of a pinned version. Only offered in the auto-deploy
// environments; anywhere else it's greyed out and off. In an environment
// that allows it, it starts as what's committed for this component in
// application-repositories (GET /api/platform/committed-releases/...), so
// the PR it opens is only ever a deliberate change. A roll back (the form
// opened with a version already chosen) pins a version, so it stays off.
export const AutoDeployToggle = ({
  formData,
  onChange,
  schema,
  formContext,
}: FieldExtensionComponentProps<boolean>) => {
  const configApi = useApi(configApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const allowed =
    configApi.getOptionalStringArray('platform.autoDeployEnvironments') ??
    DEFAULT_AUTO_DEPLOY_ENVIRONMENTS;
  const component: string | undefined = formContext?.formData?.componentName;
  const environment: string | undefined = formContext?.formData?.environment;
  // Decided once, from what the form opened with, like the other pickers.
  const [rollback] = useState(() => Boolean(formContext?.formData?.version));
  const available = !rollback && autoDeployAllowed(environment, allowed);
  const [committed, setCommitted] = useState<CommittedState>({ status: 'idle' });

  useEffect(() => {
    if (!available || !component || !environment) {
      setCommitted({ status: 'idle' });
      return undefined;
    }
    const key = `${component}/${environment}`;
    let cancelled = false;
    (async () => {
      setCommitted({ status: 'loading' });
      try {
        const release = await fetchCommittedRelease(discoveryApi, fetchApi, component, environment);
        if (!cancelled) {
          setCommitted({ status: 'done', key, release });
        }
      } catch (error) {
        if (!cancelled) {
          setCommitted({ status: 'error', error: (error as Error).message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [available, component, environment, discoveryApi, fetchApi]);

  // Start from what's committed — once per component/environment, so the
  // person's own toggling afterwards is never overwritten.
  const loadedKey = committed.status === 'done' ? committed.key : null;
  const committedValue = committed.status === 'done' ? committed.release.autoDeploy : false;
  useEffect(() => {
    if (loadedKey !== null) {
      onChange(committedValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);

  // Not available here: never leave it on.
  useEffect(() => {
    if (!available && formData) {
      onChange(false);
    }
  }, [available, formData, onChange]);

  let helperText: string = schema.description ?? '';
  if (rollback) {
    helperText = 'A roll back pins the version it rolls back to.';
  } else if (!environment) {
    helperText = 'Choose an environment first.';
  } else if (!available) {
    helperText = `Auto-deploy is only available in ${allowed.join(', ')}.`;
  } else if (committed.status === 'loading') {
    helperText = 'Loading the committed Release…';
  } else if (committed.status === 'error') {
    helperText = `Could not load the committed Release, so whether auto-deploy is on is unknown: ${committed.error}. Reload to try again.`;
  } else if (formData) {
    helperText = 'Every successful build on main deploys automatically. No version to choose.';
  }

  return (
    <FormControl fullWidth margin="normal" error={committed.status === 'error'}>
      <FormControlLabel
        control={
          <Switch
            color="primary"
            checked={available && Boolean(formData)}
            disabled={!available || committed.status === 'loading' || committed.status === 'error'}
            onChange={e => onChange(e.target.checked)}
          />
        }
        label={schema.title ?? 'Auto-deploy'}
      />
      <FormHelperText>{helperText}</FormHelperText>
    </FormControl>
  );
};

// Blocks submit when the committed Release can't be read in an auto-deploy
// environment. Without it, a failed lookup would leave the toggle at its
// default (off), and the PR would pin a version, quietly turning off an
// auto-deploy that's on in git. Checked again here, not from the toggle's
// state, because a validator only sees the form data.
export const autoDeployToggleValidation: CustomFieldValidator<boolean> = async (
  _value,
  validation,
  { apiHolder, formData },
) => {
  const configApi = apiHolder.get(configApiRef);
  const discoveryApi = apiHolder.get(discoveryApiRef);
  const fetchApi = apiHolder.get(fetchApiRef);
  const component = formData?.componentName;
  const environment = formData?.environment;
  const allowed =
    configApi?.getOptionalStringArray('platform.autoDeployEnvironments') ??
    DEFAULT_AUTO_DEPLOY_ENVIRONMENTS;
  if (
    !discoveryApi ||
    !fetchApi ||
    typeof component !== 'string' ||
    typeof environment !== 'string' ||
    !autoDeployAllowed(environment, allowed)
  ) {
    return;
  }
  try {
    await fetchCommittedRelease(discoveryApi, fetchApi, component, environment);
  } catch (error) {
    validation.addError(
      `Could not check whether auto-deploy is on for ${component} in ${environment} (${(error as Error).message}). Reload the page and try again.`,
    );
  }
};
