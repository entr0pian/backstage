import { useEffect, useRef, useState } from 'react';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

type VersionsState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; versions: string[] };

// Released versions of the chosen scaffold template, newest first, from
// GET /api/platform/scaffolds/:template/versions. Preselects the latest so
// nobody has to know which tag is current; an older one can still be picked.
export const ScaffoldVersionPicker = ({
  formData,
  onChange,
  required,
  rawErrors,
  schema,
  formContext,
}: FieldExtensionComponentProps<string>) => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const template: string | undefined = formContext?.formData?.scaffoldTemplate;
  const [state, setState] = useState<VersionsState>({ status: 'loading' });

  // Read inside the fetch effect without re-running it on every keystroke
  // elsewhere in the form (onChange's identity isn't stable).
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const loadedTemplate = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!template) {
      setState({ status: 'error', error: 'No scaffold template selected.' });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setState({ status: 'loading' });
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(
          `${baseUrl}/scaffolds/${encodeURIComponent(template)}/versions`,
        );
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
        }
        if (cancelled) {
          return;
        }
        const versions: string[] = body.versions;
        // Keep a still-valid value on first load (e.g. returning from the
        // review step); switching template always moves to its own latest.
        const keep =
          loadedTemplate.current === undefined &&
          versions.includes(formDataRef.current ?? '');
        loadedTemplate.current = template;
        if (!keep) {
          onChangeRef.current(body.latest ?? undefined);
        }
        setState({ status: 'done', versions });
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', error: (error as Error).message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi, template]);

  const versions = state.status === 'done' ? state.versions : [];
  let helperText = schema.description;
  if (state.status === 'loading') {
    helperText = 'Loading versions…';
  } else if (state.status === 'error') {
    helperText = `Could not load versions: ${state.error}`;
  } else if (versions.length === 0) {
    helperText = `${template} has no released version yet.`;
  }

  return (
    <FormControl
      fullWidth
      margin="normal"
      required={required}
      error={!!rawErrors?.length || state.status === 'error'}
      disabled={versions.length === 0}
    >
      <InputLabel id="scaffold-version-picker-label">
        {schema.title ?? 'Scaffold version'}
      </InputLabel>
      <Select
        labelId="scaffold-version-picker-label"
        value={versions.includes(formData ?? '') ? formData : ''}
        onChange={e => onChange(e.target.value as string)}
      >
        {versions.map((v, i) => (
          <MenuItem key={v} value={v}>
            {i === 0 ? `${v} (latest)` : v}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>{helperText}</FormHelperText>
    </FormControl>
  );
};
