import { createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';
import { z } from 'zod/v4';

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
const deploymentsContent = EntityContentBlueprint.makeWithOverrides({
  name: 'deployments',
  configSchema: {
    // Browser-reachable Argo CD UI, for "Open in Argo CD" deep links —
    // not argocd-backend's in-cluster URL. Omit to hide the link.
    argocdUiUrl: z.string().optional(),
  },
  factory(originalFactory, { config }) {
    return originalFactory({
      path: 'deployments',
      title: 'Deployments',
      filter: isService,
      loader: () =>
        import('./DeploymentsContent').then(m => (
          <m.DeploymentsContent argocdUiUrl={config.argocdUiUrl} />
        )),
    });
  },
});

export const deploymentsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [deploymentsCard, deploymentsContent],
});
