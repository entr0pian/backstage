import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import { RELATION_DEPENDS_ON, type Entity } from '@backstage/catalog-model';

const isService = (entity: Entity) =>
  entity.kind === 'Component' && entity.spec?.type === 'service';

// The tab only appears once the service depends on at least one Resource
// (e.g. a platform Database) — read from the entity's own relations, so
// deciding costs no request.
export const hasDependencies = (entity: Entity) =>
  isService(entity) &&
  (entity.relations ?? []).some(r => r.type === RELATION_DEPENDS_ON && r.targetRef.startsWith('resource:'));

// Overview summary: one row per environment with dependencies.
const dependenciesCard = EntityCardBlueprint.make({
  name: 'dependencies',
  params: {
    // 'content', matching deployments/index.tsx — see that file's comment.
    type: 'content',
    filter: isService,
    loader: () =>
      import('./DependenciesCard').then(m => <m.DependenciesCard />),
  },
});

// The Dependencies tab: one card per environment, like Deployments and
// Metrics.
const dependenciesContent = EntityContentBlueprint.make({
  name: 'dependencies',
  params: {
    path: 'dependencies',
    title: 'Dependencies',
    group: 'dependencies',
    filter: hasDependencies,
    loader: () => import('./DependenciesContent').then(m => <m.DependenciesContent />),
  },
});

export const dependenciesModule = createFrontendModule({
  pluginId: 'app',
  extensions: [dependenciesCard, dependenciesContent],
});
