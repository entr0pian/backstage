import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

const deploymentsCard = EntityCardBlueprint.make({
  name: 'deployments',
  params: {
    type: 'info',
    filter: (entity: Entity) =>
      entity.kind === 'Component' && entity.spec?.type === 'service',
    loader: () =>
      import('./DeploymentsCard').then(m => <m.DeploymentsCard />),
  },
});

export const deploymentsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [deploymentsCard],
});
