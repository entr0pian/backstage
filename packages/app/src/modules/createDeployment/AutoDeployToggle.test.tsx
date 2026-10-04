import { screen, waitFor } from '@testing-library/react';
import { mockApis, renderInTestApp } from '@backstage/frontend-test-utils';
import { AutoDeployToggle } from './AutoDeployToggle';

const committed = (autoDeploy: boolean) =>
  jest.fn(async () =>
    new Response(JSON.stringify({ exists: true, autoDeploy, version: null, bindings: {} }), {
      status: 200,
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
});
