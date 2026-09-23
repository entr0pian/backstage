import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { PlatformEntityProvider } from './PlatformEntityProvider';

// Registers PlatformEntityProvider with the catalog, gated by
// platformCatalog.enabled (see app-config.yaml — off by default, so local
// `yarn start` needs no Kubernetes cluster; the deployed chart turns it on
// via app-config.cluster.yaml). See BACKSTAGE_PART4.md for the full design.
export const platformEntityProviderModule = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'platform-entity-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
      },
      async init({ catalog, config, logger, scheduler }) {
        if (!config.getOptionalBoolean('platformCatalog.enabled')) {
          logger.info(
            'platformCatalog.enabled is not true — Platform Entity Provider not registered',
          );
          return;
        }

        const namespaces =
          config.getOptionalStringArray('platformCatalog.namespaces') ?? [];
        if (namespaces.length === 0) {
          logger.warn(
            'platformCatalog.enabled is true but platformCatalog.namespaces is empty — Platform Entity Provider will discover nothing',
          );
        }

        const schedule = scheduler.createScheduledTaskRunner({
          frequency: { seconds: 60 },
          timeout: { seconds: 30 },
        });

        catalog.addEntityProvider(
          new PlatformEntityProvider({ namespaces, logger, schedule }),
        );
      },
    });
  },
});

export default platformEntityProviderModule;
