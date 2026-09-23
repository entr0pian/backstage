import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

const dependenciesCard = EntityCardBlueprint.make({
  name: 'dependencies',
  params: {
    // 'content', matching deployments/index.tsx — see that file's comment.
    type: 'content',
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
