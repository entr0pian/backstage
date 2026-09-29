import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { AppRootWrapperBlueprint } from '@backstage/plugin-app-react';
import { ReadOnlyTemplateGuard } from './ReadOnlyTemplateGuard';

// Explains read-only access to guests who open a template (see
// ReadOnlyTemplateGuard).
const readOnlyTemplateGuard = AppRootWrapperBlueprint.make({
  name: 'read-only-template-guard',
  params: { component: ReadOnlyTemplateGuard },
});

export const readOnlyModule = createFrontendModule({
  pluginId: 'app',
  extensions: [readOnlyTemplateGuard],
});
