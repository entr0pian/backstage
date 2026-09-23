import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

const deploymentsCard = EntityCardBlueprint.make({
  name: 'deployments',
  params: {
    // 'content' (not 'info'): platform state belongs in the wide main
    // column, not the narrow sidebar reserved for metadata — see
    // DefaultEntityContentLayout's card-type -> grid-column mapping.
    type: 'content',
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
