import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

const dependenciesCard = EntityCardBlueprint.make({
  name: 'dependencies',
  params: {
    type: 'info',
    filter: (entity: Entity) =>
      entity.kind === 'Component' && entity.spec?.type === 'service',
    loader: () =>
      import('./DependenciesCard').then(m => <m.DependenciesCard />),
  },
});

export const dependenciesModule = createFrontendModule({
  pluginId: 'app',
  extensions: [dependenciesCard],
});
