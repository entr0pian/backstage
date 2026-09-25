import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

const isService = (entity: Entity) =>
  entity.kind === 'Component' && entity.spec?.type === 'service';

const deploymentsCard = EntityCardBlueprint.make({
  name: 'deployments',
  params: {
    // 'content' (not 'info'): platform state belongs in the wide main
    // column, not the narrow sidebar reserved for metadata — see
    // DefaultEntityContentLayout's card-type -> grid-column mapping.
    type: 'content',
    filter: isService,
    loader: () =>
      import('./DeploymentsCard').then(m => <m.DeploymentsCard />),
  },
});

// The one Deployments tab — replaces the Argo CD plugin's separate
// Deployment Lifecycle / Deployment Summary tabs (disabled in
// app-config.yaml). See platform-architecture/BACKSTAGE_PART7.md.
const deploymentsContent = EntityContentBlueprint.make({
  name: 'deployments',
  params: {
    path: 'deployments',
    title: 'Deployments',
    // Tabs are ordered by group (page:catalog/entity's groups config in
    // app-config.yaml), not by extension order; ungrouped tabs go last.
    group: 'deployment',
    filter: isService,
    loader: () => import('./DeploymentsContent').then(m => <m.DeploymentsContent />),
  },
});

export const deploymentsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [deploymentsCard, deploymentsContent],
});
