import {
  createFrontendModule,
  githubAuthApiRef,
} from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';

// Overrides plugin-app's default guest-only sign-in page (same extension id,
// sign-in-page:app). Guest is for visitors browsing the portfolio; GitHub is
// the owner's sign-in — the backend's resolver only accepts a GitHub user
// with a matching User entity (org-data/users.yaml), and the permission
// policy only grants that user anything beyond read access.
const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => {
      const { SignInPage } = await import('@backstage/core-components');
      return props => (
        <SignInPage
          {...props}
          title="gerodimos.dev platform"
          providers={[
            'guest',
            {
              id: 'github-auth-provider',
              title: 'GitHub',
              message: 'Owner sign-in',
              apiRef: githubAuthApiRef,
            },
          ]}
        />
      );
    },
  },
});

export const signInModule = createFrontendModule({
  pluginId: 'app',
  extensions: [signInPage],
});
