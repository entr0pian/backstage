import { screen, waitFor } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { AutoDeploySetup } from './AutoDeploySetup';

const render = (autoDeployEnvironments: string[] | undefined, formData?: Record<string, unknown>) => {
  const onChange = jest.fn();
  return {
    onChange,
    rendered: renderInTestApp(
      <AutoDeploySetup
        {...({
          formData: formData ?? { enabled: true },
          onChange,
          schema: { title: 'Auto deployment', description: 'Follow main.' },
        } as any)}
      />,
      { config: autoDeployEnvironments ? { platform: { autoDeployEnvironments } } : {} },
    ),
  };
};

describe('AutoDeploySetup', () => {
  it('is on by default, for the first auto-deploy environment in config', async () => {
    const { rendered, onChange } = render(['staging', 'dev']);
    await rendered;
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Set up auto deployment to staging')).toBeInTheDocument();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ enabled: true, environment: 'staging' }));
  });

  it('falls back to dev when the config has no list', async () => {
    const { rendered, onChange } = render(undefined);
    await rendered;
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ enabled: true, environment: 'dev' }));
  });

  it('keeps the person choosing off', async () => {
    const { rendered } = render(['dev'], { enabled: false, environment: 'dev' });
    await rendered;
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('is off and greyed out when no environment allows auto-deploy', async () => {
    const { rendered, onChange } = render([]);
    await rendered;
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ enabled: false, environment: undefined }));
  });
});
