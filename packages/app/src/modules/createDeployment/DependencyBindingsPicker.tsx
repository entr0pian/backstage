import { useEffect, useMemo, useState } from 'react';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormLabel from '@material-ui/core/FormLabel';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import { Link } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { addDatabaseHref } from '../platformActions/addDatabaseHref';
import {
  bindingOptions,
  pruneBindings,
  type BindingOption,
  type DependencyBindings,
} from './bindings';

type OptionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'done'; options: Record<string, BindingOption[]> };

const NONE = '';

// The component's dependencies in the chosen environment — catalog
// Resources the Platform Entity Provider publishes with dependencyOf the
// component and a platform.taskapp.io/environment annotation — one dropdown
// per bindable type (bindings.ts). A Release binds at most one resource per
// type. Changing the environment drops bindings it doesn't offer.
export const DependencyBindingsPicker = ({
  formData,
  onChange,
  schema,
  formContext,
}: FieldExtensionComponentProps<DependencyBindings>) => {
  const catalogApi = useApi(catalogApiRef);
  const component: string | undefined = formContext?.formData?.componentName;
  const environment: string | undefined = formContext?.formData?.environment;
  const value = useMemo(() => formData ?? {}, [formData]);
  const [state, setState] = useState<OptionsState>({ status: 'idle' });

  useEffect(() => {
    if (!component || !environment) {
      setState({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setState({ status: 'loading' });
      try {
        const { items } = await catalogApi.getEntities({
          filter: {
            kind: 'Resource',
            'relations.dependencyOf': `component:default/${component}`,
            'metadata.annotations.platform.taskapp.io/environment': environment,
          },
        });
        if (!cancelled) {
          setState({ status: 'done', options: bindingOptions(items) });
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
  }, [catalogApi, component, environment]);

  // Environment changed (or a resource disappeared): drop what's no longer
  // offered, so the Release never binds something from another environment.
  useEffect(() => {
    if (state.status !== 'done') {
      return;
    }
    const pruned = pruneBindings(value, state.options);
    if (Object.keys(pruned).length !== Object.keys(value).length) {
      onChange(pruned);
    }
  }, [state, value, onChange]);

  const title = schema.title ?? 'Bind dependencies';

  if (state.status !== 'done') {
    let message = 'Choose an environment first.';
    if (state.status === 'loading') message = 'Loading dependencies…';
    if (state.status === 'error') message = `Could not load dependencies: ${state.error}`;
    return (
      <FormControl fullWidth margin="normal" error={state.status === 'error'}>
        <FormLabel>{title}</FormLabel>
        <FormHelperText>{message}</FormHelperText>
      </FormControl>
    );
  }

  const types = Object.keys(state.options);
  if (types.length === 0) {
    return (
      <FormControl fullWidth margin="normal">
        <FormLabel>{title}</FormLabel>
        <Typography variant="body2">
          {component} has no dependencies in {environment}.{' '}
          <Link to={addDatabaseHref(component!, environment)}>Add a database</Link> to bind one.
        </Typography>
      </FormControl>
    );
  }

  return (
    <FormControl fullWidth margin="normal" component="fieldset">
      <FormLabel component="legend">{title}</FormLabel>
      {types.map(type => {
        const options = state.options[type];
        const id = `binding-${type}-label`;
        return (
          <FormControl key={type} fullWidth margin="dense">
            <InputLabel id={id}>{options[0].label}</InputLabel>
            <Select
              labelId={id}
              value={value[type] ?? NONE}
              onChange={e => {
                const { [type]: _removed, ...rest } = value;
                const ref = e.target.value as string;
                onChange(ref === NONE ? rest : { ...rest, [type]: ref });
              }}
            >
              <MenuItem value={NONE}>
                <em>Don't bind</em>
              </MenuItem>
              {options.map(o => (
                <MenuItem key={o.ref} value={o.ref}>
                  {o.ref}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      })}
      <FormHelperText>{schema.description}</FormHelperText>
    </FormControl>
  );
};
