import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

export const isService = (entity: Entity) =>
  entity.kind === 'Component' && entity.spec?.type === 'service';

// The Metrics tab: per-environment golden signals from the platform
// backend's fixed-query observability route, each card deep-linking into
// Grafana's Platform — Service Overview. See
// platform-architecture/OBSERVABILLITY_PART4.md Part 3.
export const metricsContent = EntityContentBlueprint.make({
  name: 'metrics',
  params: {
    path: 'metrics',
    title: 'Metrics',
    group: 'observability',
    filter: isService,
    loader: () => import('./MetricsContent').then(m => <m.MetricsContent />),
  },
});

export const metricsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [metricsContent],
});
