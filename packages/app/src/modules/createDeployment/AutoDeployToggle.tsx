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
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import {
  DEFAULT_AUTO_DEPLOY_ENVIRONMENTS,
  autoDeployAllowed,
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
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(
          `${baseUrl}/committed-releases/${encodeURIComponent(component)}/${encodeURIComponent(environment)}`,
        );
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
        }
        if (!cancelled) {
          setCommitted({ status: 'done', key, release: body });
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
    helperText = `Could not load the committed Release: ${committed.error}`;
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
            disabled={!available || committed.status === 'loading'}
            onChange={e => onChange(e.target.checked)}
          />
        }
        label={schema.title ?? 'Auto-deploy'}
      />
      <FormHelperText>{helperText}</FormHelperText>
    </FormControl>
  );
};
