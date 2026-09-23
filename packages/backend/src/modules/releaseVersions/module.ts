import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { ReleaseVersionReader } from './ReleaseVersionReader';
import { createRouter } from './router';

// Exposes GET /api/platform/releases/:component. Gated on
// platformCatalog.enabled/platformCatalog.namespaces — the same flag and
// namespace list PlatformEntityProvider already uses, since both need the
// same Kubernetes connectivity/RBAC (see
// backstage/chart/templates/clusterrole.yaml — one ClusterRole, two
// resource types). No dependency on deployments.enabled/Argo CD
// connectivity at all — see BACKSTAGE_PART5.md's "Architecture" section.
export const releaseVersionsModule = createBackendPlugin({
  pluginId: 'platform',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ config, httpRouter, logger }) {
        if (!config.getOptionalBoolean('platformCatalog.enabled')) {
          logger.info(
            'platformCatalog.enabled is not true — Release Versions route not registered',
          );
          return;
        }

        const namespaces =
          config.getOptionalStringArray('platformCatalog.namespaces') ?? [];
        const reader = new ReleaseVersionReader({ namespaces, logger });
        httpRouter.use(createRouter(reader));
        httpRouter.addAuthPolicy({ path: '/releases', allow: 'unauthenticated' });
      },
    });
  },
});

export default releaseVersionsModule;
