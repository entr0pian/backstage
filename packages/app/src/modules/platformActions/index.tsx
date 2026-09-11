import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

const platformActionsCard = EntityCardBlueprint.make({
  name: 'platform-actions',
  params: {
    type: 'info',
    filter: (entity: Entity) =>
      entity.kind === 'Component' && entity.spec?.type === 'service',
    loader: () =>
      import('./PlatformActionsCard').then(m => <m.PlatformActionsCard />),
  },
});

export const platformActionsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [platformActionsCard],
});
