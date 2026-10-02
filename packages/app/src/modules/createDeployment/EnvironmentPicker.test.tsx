import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { EnvironmentPicker } from './EnvironmentPicker';

const render = (formData: string | undefined) =>
  renderInTestApp(
    <EnvironmentPicker
      {...({
        formData,
        onChange: jest.fn(),
        required: true,
        rawErrors: [],
        schema: { title: 'Environment', description: 'Where it should run.' },
      } as any)}
    />,
    { config: { platform: { environments: ['management', 'dev'] } } },
  );

describe('EnvironmentPicker', () => {
  it('stays locked to the environment a roll back opened it with', async () => {
    await render('dev');
    const select = screen.getByRole('button');
    expect(select).toHaveTextContent('dev');
    expect(select).toHaveAttribute('aria-disabled', 'true');
  });

  it('is a free choice when opened without one', async () => {
    await render(undefined);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-disabled');
  });
});
