import { screen, waitFor } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { usePermission } from '@backstage/plugin-permission-react';
import { ReadOnlyTemplateGuard } from './ReadOnlyTemplateGuard';

// usePermission caches decisions across renders (SWR), so each test sets
// the decision directly instead of going through a mock PermissionApi.
jest.mock('@backstage/plugin-permission-react', () => ({
  ...jest.requireActual('@backstage/plugin-permission-react'),
  usePermission: jest.fn(),
}));

const render = (path: string, allowed: boolean) => {
  (usePermission as jest.Mock).mockReturnValue({ loading: false, allowed });
  return renderInTestApp(
    <ReadOnlyTemplateGuard>
      <div>page content</div>
    </ReadOnlyTemplateGuard>,
    { initialRouteEntries: [path] },
  );
};

describe('ReadOnlyTemplateGuard', () => {
  it('explains read-only access to a guest opening a template', async () => {
    await render('/create/templates/default/onboard-service', false);
    expect(await screen.findByText("You're browsing read-only")).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view template source/i })).toHaveAttribute(
      'href',
      'https://github.com/entr0pian/backstage/tree/main/templates/onboard-service',
    );
    expect(screen.getByRole('button', { name: 'Back to templates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeInTheDocument();
  });

  it('stays out of the way for the owner', async () => {
    await render('/create/templates/default/onboard-service', true);
    await waitFor(() => expect(screen.getByText('page content')).toBeInTheDocument());
    expect(screen.queryByText("You're browsing read-only")).not.toBeInTheDocument();
  });

  it('only applies to template pages', async () => {
    await render('/create', false);
    await waitFor(() => expect(screen.getByText('page content')).toBeInTheDocument());
    expect(screen.queryByText("You're browsing read-only")).not.toBeInTheDocument();
  });
});
