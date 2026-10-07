import { useEffect, useMemo, useState } from 'react';
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
import { schemaVersionOptions, type SchemaVersion } from './schemaVersions';

// What the field submits: the version to apply, plus what the template's
// pull request shows (the comparison with the environment's current version
// and the migration files it adds).
export interface SchemaVersionValue {
  version: string;
  previous?: string;
  repository?: string;
  files?: string[];
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; versions: SchemaVersion[]; repository: string; current: string | null };

type ChangesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; files: { name: string; status: string }[] };

const useStyles = makeStyles(theme => ({
  sha: { fontFamily: 'monospace', marginRight: theme.spacing(1.5), flexShrink: 0 },
  message: { flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { marginLeft: theme.spacing(1.5), flexShrink: 0 },
  files: { margin: theme.spacing(1, 0, 0), paddingLeft: theme.spacing(2.5) },
  file: { fontFamily: 'monospace', fontSize: '0.85rem' },
}));

// Schema versions of a component: commits on main whose schema workflow
// published a package (GET /api/platform/schema-versions/:component), newest
// first. The environment's current version (the DatabaseSchema committed in
// git) is marked, and older ones are disabled: the platform migrates forward
// only. Picking one shows which migration files it adds.
export const SchemaVersionPicker = ({
  formData,
  onChange,
  required,
  rawErrors,
  schema,
  formContext,
}: FieldExtensionComponentProps<SchemaVersionValue>) => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const component: string | undefined = formContext?.formData?.componentName;
  const environment: string | undefined = formContext?.formData?.environment;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [changes, setChanges] = useState<ChangesState>({ status: 'idle' });

  useEffect(() => {
    if (!component || !environment) {
      setState({ status: 'error', error: 'Choose a component and an environment first.' });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setState({ status: 'loading' });
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const [versionsRes, statusRes] = await Promise.all([
          fetchApi.fetch(`${baseUrl}/schema-versions/${encodeURIComponent(component)}`),
          fetchApi.fetch(`${baseUrl}/schemas/${encodeURIComponent(component)}/${encodeURIComponent(environment)}?committed=1`),
        ]);
        const [versionsBody, statusBody] = await Promise.all([versionsRes.json(), statusRes.json()]);
        if (!versionsRes.ok) {
          throw new Error(versionsBody?.error ?? `${versionsRes.status} ${versionsRes.statusText}`);
        }
        if (!statusRes.ok) {
          throw new Error(statusBody?.error ?? `${statusRes.status} ${statusRes.statusText}`);
        }
        if (!cancelled) {
          setState({
            status: 'done',
            versions: versionsBody.versions,
            repository: versionsBody.repository,
            current: statusBody.committedVersion ?? null,
          });
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
  }, [discoveryApi, fetchApi, component, environment]);

  const current = state.status === 'done' ? state.current : null;
  const repository = state.status === 'done' ? state.repository : undefined;
  const options = useMemo(
    () => (state.status === 'done' ? schemaVersionOptions(state.versions, state.current) : []),
    [state],
  );
  const selected = formData?.version;

  // A choice made for another component or environment no longer applies.
  useEffect(() => {
    if (state.status === 'done' && selected && !options.some(o => o.version.sha === selected && o.selectable)) {
      onChange(undefined as unknown as SchemaVersionValue);
    }
  }, [state, selected, options, onChange]);

  // The migration files the chosen version adds over the current one.
  useEffect(() => {
    if (!component || !selected) {
      setChanges({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setChanges({ status: 'loading' });
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const query = new URLSearchParams({ head: selected, ...(current ? { base: current } : {}) });
        const res = await fetchApi.fetch(`${baseUrl}/schema-changes/${encodeURIComponent(component)}?${query}`);
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
        }
        if (!cancelled) {
          setChanges({ status: 'done', files: body.files });
          const files = (body.files as { name: string }[]).map(f => f.name);
          if (JSON.stringify(files) !== JSON.stringify(formData?.files ?? [])) {
            onChange({ version: selected, previous: current ?? undefined, repository, files });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setChanges({ status: 'error', error: (error as Error).message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // formData.files is written here; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryApi, fetchApi, component, selected, current, repository]);

  let helperText = schema.description;
  if (state.status === 'loading') {
    helperText = 'Loading schema versions…';
  } else if (state.status === 'error') {
    helperText = `Could not load schema versions: ${state.error}`;
  } else if (state.versions.length === 0) {
    helperText = 'No commit on main has a published schema package yet (its schema workflow runs when migrations/ changes).';
  } else if (current && !state.versions.some(v => v.sha === current)) {
    helperText = `${environment} is at ${current.slice(0, 7)}, older than the versions listed: pick one that only adds migrations.`;
  }

  return (
    <FormControl
      fullWidth
      margin="normal"
      required={required}
      error={!!rawErrors?.length || state.status === 'error'}
      disabled={options.every(o => !o.selectable)}
    >
      <InputLabel id="schema-version-picker-label">{schema.title ?? 'Schema version'}</InputLabel>
      <Select
        labelId="schema-version-picker-label"
        value={options.some(o => o.version.sha === selected) ? selected : ''}
        onChange={e => onChange({ version: e.target.value as string, previous: current ?? undefined, repository })}
        renderValue={value => {
          const o = options.find(x => x.version.sha === value);
          return o ? `${o.version.shortSha} — ${o.version.message}` : '';
        }}
      >
        {options.map(({ version: v, label, selectable }) => (
          <MenuItem key={v.sha} value={v.sha} disabled={!selectable}>
            <Box display="flex" width="100%" alignItems="baseline">
              <span className={classes.sha}>{v.shortSha}</span>
              <span className={classes.message}>{v.message}</span>
              <Typography variant="caption" color="textSecondary" className={classes.meta}>
                {label ? `${label} · ` : ''}
                {v.author} · {timeAgo(v.createdAt) ?? ''}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>{helperText}</FormHelperText>
      {changes.status === 'loading' && <FormHelperText>Comparing with {environment}…</FormHelperText>}
      {changes.status === 'error' && (
        <FormHelperText error>Could not compare with {environment}: {changes.error}</FormHelperText>
      )}
      {changes.status === 'done' && (
        <Box mt={1}>
          <Typography variant="body2">
            {changes.files.length === 0
              ? `No migration files change compared with ${environment}'s current version.`
              : `Applies ${changes.files.length} migration file${changes.files.length === 1 ? '' : 's'} to ${environment}:`}
          </Typography>
          {changes.files.length > 0 && (
            <ul className={classes.files}>
              {changes.files.map(f => (
                <li key={f.name} className={classes.file}>
                  {f.name}
                  {f.status === 'added' ? '' : ` (${f.status})`}
                </li>
              ))}
            </ul>
          )}
        </Box>
      )}
    </FormControl>
  );
};
