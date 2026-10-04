import { screen, waitFor } from '@testing-library/react';
import { mockApis, renderInTestApp } from '@backstage/frontend-test-utils';
import { configApiRef, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { AutoDeployToggle, autoDeployToggleValidation } from './AutoDeployToggle';

const committed = (autoDeploy: boolean) =>
  jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
    new Response(JSON.stringify({ exists: true, autoDeploy, version: null, bindings: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const failing = () =>
  jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
    new Response(JSON.stringify({ error: 'GitHub is down' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

const render = (
  formData: Record<string, unknown>,
  options: { value?: boolean; fetch?: jest.Mock; onChange?: jest.Mock } = {},
) => {
  const onChange = options.onChange ?? jest.fn();
  const fetch = options.fetch ?? committed(false);
  return {
    onChange,
    fetch,
    rendered: renderInTestApp(
      <AutoDeployToggle
        {...({
          formData: options.value,
          onChange,
          schema: { title: 'Auto-deploy', description: 'Follow main.' },
          formContext: { formData: { componentName: 'orders', ...formData } },
        } as any)}
      />,
      {
        config: { platform: { autoDeployEnvironments: ['dev'] } },
        apis: [mockApis.fetch({ baseImplementation: fetch as any }), mockApis.discovery()],
      },
    ),
  };
};

describe('AutoDeployToggle', () => {
  it('is greyed out and off outside the auto-deploy environments, without asking the backend', async () => {
    const { rendered, fetch } = render({ environment: 'prod' });
    await rendered;
    const toggle = screen.getByRole('checkbox');
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Auto-deploy is only available in dev.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('turns itself off when the environment changes to one without auto-deploy', async () => {
    const { rendered, onChange } = render({ environment: 'prod' }, { value: true });
    await rendered;
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('starts as what is committed in application-repositories for dev', async () => {
    const fetch = committed(true);
    const { rendered, onChange } = render({ environment: 'dev' }, { fetch });
    await rendered;
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(String(fetch.mock.calls[0][0])).toContain('/committed-releases/orders/dev');
  });

  it('starts off in dev when the committed Release pins a version', async () => {
    const { rendered, onChange } = render({ environment: 'dev' }, { fetch: committed(false) });
    await rendered;
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
    expect(onChange).not.toHaveBeenCalledWith(true);
  });

  it('stays off for a roll back, which always pins a version', async () => {
    const { rendered, fetch } = render({ environment: 'dev', version: 'a'.repeat(40) });
    await rendered;
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('A roll back pins the version it rolls back to.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('is locked when the committed Release cannot be loaded, instead of defaulting to off', async () => {
    const { rendered, onChange } = render({ environment: 'dev' }, { fetch: failing() });
    await rendered;
    expect(await screen.findByText(/Could not load the committed Release/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('autoDeployToggleValidation', () => {
  const validate = async (fetch: jest.Mock, formData: Record<string, unknown>) => {
    const apis = new Map<string, unknown>([
      [configApiRef.id, mockApis.config({ data: { platform: { autoDeployEnvironments: ['dev'] } } })],
      [discoveryApiRef.id, mockApis.discovery()],
      [fetchApiRef.id, { fetch }],
    ]);
    const validation = { addError: jest.fn() };
    await autoDeployToggleValidation(false, validation as any, {
      apiHolder: { get: (ref: { id: string }) => apis.get(ref.id) } as any,
      formData: { componentName: 'orders', ...formData } as any,
      schema: {},
    });
    return validation.addError;
  };

  it('blocks submit when the committed Release cannot be read in an auto-deploy environment', async () => {
    const addError = await validate(failing(), { environment: 'dev' });
    expect(addError).toHaveBeenCalledWith(expect.stringContaining('GitHub is down'));
  });

  it('passes when the committed Release can be read', async () => {
    const addError = await validate(committed(true), { environment: 'dev' });
    expect(addError).not.toHaveBeenCalled();
  });

  it('does not ask the backend outside the auto-deploy environments', async () => {
    const fetch = failing();
    const addError = await validate(fetch, { environment: 'prod' });
    expect(addError).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
