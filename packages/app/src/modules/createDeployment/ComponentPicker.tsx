import { useEffect, useState } from 'react';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';

interface ServiceOption {
  name: string;
  description?: string;
}

// The service a template acts on. Launched from a service's page, the form
// arrives with it filled in (formData query param) and it stays locked to
// that service; launched from Home or the template list, it's a dropdown of
// the catalog's services.
export const ComponentPicker = ({
  formData,
  onChange,
  required,
  rawErrors,
  schema,
}: FieldExtensionComponentProps<string>) => {
  const catalogApi = useApi(catalogApiRef);
  // Decided once, from what the form opened with.
  const [locked] = useState(() => Boolean(formData));
  const [services, setServices] = useState<ServiceOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (locked) return undefined;
    let cancelled = false;
    catalogApi
      .getEntities({
        filter: { kind: 'Component', 'spec.type': 'service' },
        fields: ['metadata.name', 'metadata.description'],
      })
      .then(res => {
        if (cancelled) return;
        setServices(
          res.items
            .map(e => ({ name: e.metadata.name, description: e.metadata.description }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(e => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [catalogApi, locked]);

  const label = schema.title ?? 'Component';

  if (locked) {
    return (
      <FormControl fullWidth margin="normal" required={required} disabled>
        <InputLabel htmlFor="component-picker-locked">{label}</InputLabel>
        <Input id="component-picker-locked" value={formData ?? ''} readOnly />
        <FormHelperText>{schema.description}</FormHelperText>
      </FormControl>
    );
  }

  let helper = schema.description;
  if (error) helper = `Could not load services: ${error}`;
  else if (services?.length === 0) helper = 'No services in the catalog yet — onboard one first.';

  return (
    <FormControl
      fullWidth
      margin="normal"
      required={required}
      error={!!rawErrors?.length || !!error}
      disabled={!services?.length}
    >
      <InputLabel id="component-picker-label">{label}</InputLabel>
      <Select
        labelId="component-picker-label"
        value={services?.some(s => s.name === formData) ? formData : ''}
        onChange={e => onChange(e.target.value as string)}
      >
        {(services ?? []).map(s => (
          <MenuItem key={s.name} value={s.name}>
            <span>
              <Typography component="span" style={{ fontWeight: 600 }}>
                {s.name}
              </Typography>
              {s.description && (
                <Typography component="span" variant="caption" color="textSecondary" style={{ marginLeft: 8 }}>
                  {s.description}
                </Typography>
              )}
            </span>
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>{helper}</FormHelperText>
    </FormControl>
  );
};
