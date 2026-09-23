import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

const releaseVersionsCard = EntityCardBlueprint.make({
  name: 'release-versions',
  params: {
    type: 'info',
    filter: (entity: Entity) =>
      entity.kind === 'Component' && entity.spec?.type === 'service',
    loader: () =>
      import('./ReleaseVersionsCard').then(m => <m.ReleaseVersionsCard />),
  },
});

export const releaseVersionsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [releaseVersionsCard],
});
