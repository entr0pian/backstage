import { useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { timeAgo } from '../platformUi';

// Mirrors the backend's DeployableVersion (modules/releaseVersions).
interface DeployableVersion {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  createdAt: string;
}

type VersionsState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; versions: DeployableVersion[] };

const useStyles = makeStyles(theme => ({
  sha: {
    fontFamily: 'monospace',
    marginRight: theme.spacing(1.5),
    flexShrink: 0,
  },
  message: {
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    marginLeft: theme.spacing(1.5),
    flexShrink: 0,
  },
}));

// Commits on the component repo's main that have an image (their CI run
// succeeded), newest first, from GET /api/platform/versions/:component. The
// value is the full SHA — the image tag, and the Release's spec.version.
export const VersionPicker = ({
  formData,
  onChange,
  required,
  rawErrors,
  schema,
  formContext,
}: FieldExtensionComponentProps<string>) => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const component: string | undefined = formContext?.formData?.componentName;
  const [state, setState] = useState<VersionsState>({ status: 'loading' });

  useEffect(() => {
    if (!component) {
      setState({ status: 'error', error: 'No component selected.' });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setState({ status: 'loading' });
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(`${baseUrl}/versions/${encodeURIComponent(component)}`);
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
        }
        if (!cancelled) {
          setState({ status: 'done', versions: body.versions });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', error: (error as Error).message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi, component]);

  const versions = state.status === 'done' ? state.versions : [];
  let helperText = schema.description;
  if (state.status === 'loading') {
    helperText = 'Loading versions…';
  } else if (state.status === 'error') {
    helperText = `Could not load versions: ${state.error}`;
  } else if (versions.length === 0) {
    helperText = 'No commit on main has a built image yet.';
  }

  return (
    <FormControl
      fullWidth
      margin="normal"
      required={required}
      error={!!rawErrors?.length || state.status === 'error'}
      disabled={versions.length === 0}
    >
      <InputLabel id="version-picker-label">{schema.title ?? 'Version'}</InputLabel>
      <Select
        labelId="version-picker-label"
        value={versions.some(v => v.sha === formData) ? formData : ''}
        onChange={e => onChange(e.target.value as string)}
        renderValue={value => {
          const v = versions.find(x => x.sha === value);
          return v ? `${v.shortSha} — ${v.message}` : '';
        }}
      >
        {versions.map(v => (
          <MenuItem key={v.sha} value={v.sha}>
            <Box display="flex" width="100%" alignItems="baseline">
              <span className={classes.sha}>{v.shortSha}</span>
              <span className={classes.message}>{v.message}</span>
              <Typography variant="caption" color="textSecondary" className={classes.meta}>
                {v.author} · {timeAgo(v.createdAt) ?? ''}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>{helperText}</FormHelperText>
    </FormControl>
  );
};
