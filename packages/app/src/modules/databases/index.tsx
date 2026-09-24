import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

// Database Resources published by the backend's Platform Entity Provider —
// the only ones carrying the kubernetes-namespace annotation the card needs.
const isPlatformDatabase = (entity: Entity) =>
  entity.kind === 'Resource' &&
  entity.spec?.type === 'database' &&
  Boolean(entity.metadata.annotations?.['platform.taskapp.io/kubernetes-namespace']);

// The platform view of a Database on its Overview (BACKSTAGE_PART9.md Part
// B). 'content' so it takes the wide main column next to the About card.
const databaseCard = EntityCardBlueprint.make({
  name: 'database',
  params: {
    type: 'content',
    filter: isPlatformDatabase,
    loader: () => import('./DatabaseCard').then(m => <m.DatabaseCard />),
  },
});

export const databasesModule = createFrontendModule({
  pluginId: 'app',
  extensions: [databaseCard],
});
