import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityHeaderLayoutBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

const isService = (entity: Entity) =>
  entity.kind === 'Component' && entity.spec?.type === 'service';

// Brand header for service pages; other entities keep the default header.
const serviceHeader = EntityHeaderLayoutBlueprint.make({
  name: 'service',
  params: {
    filter: isService,
    loader: () => import('./ServiceHeader').then(m => m.ServiceHeader),
  },
});

export const serviceHeaderModule = createFrontendModule({
  pluginId: 'app',
  extensions: [serviceHeader],
});
