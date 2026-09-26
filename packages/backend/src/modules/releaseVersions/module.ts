import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import {
  DefaultGithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import { ReleaseVersionReader } from './ReleaseVersionReader';
import { DeployableVersionReader } from './DeployableVersionReader';
import { createRouter } from './router';
import { EnvironmentSummaryReader } from '../environmentSummary/EnvironmentSummaryReader';
import { DatabaseSummaryReader } from '../databaseSummary/DatabaseSummaryReader';

// Exposes GET /api/platform/releases/:component and
// GET /api/platform/environments/:component/:environment and
// GET /api/platform/databases/:namespace/:name (BACKSTAGE_PART9.md) and
// GET /api/platform/versions/:component (DEPLOYMENTS.md Step 1). Gated on
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
        httpAuth: coreServices.httpAuth,
        permissions: coreServices.permissions,
        logger: coreServices.logger,
        catalog: catalogServiceRef,
      },
      async init({ config, httpRouter, httpAuth, permissions, logger, catalog }) {
        if (!config.getOptionalBoolean('platformCatalog.enabled')) {
          logger.info(
            'platformCatalog.enabled is not true — Release Versions route not registered',
          );
          return;
        }

        const namespaces =
          config.getOptionalStringArray('platformCatalog.namespaces') ?? [];
        const reader = new ReleaseVersionReader({ namespaces, logger });
        // No addAuthPolicy: the default (user or service credentials
        // required) is what we want — the Deployments card calls this via
        // fetchApi, which already sends the signed-in user's token.
        httpRouter.use(
          createRouter({
            reader,
            environments: new EnvironmentSummaryReader(reader, logger),
            databases: new DatabaseSummaryReader(namespaces, reader, logger),
            versions: new DeployableVersionReader({
              catalog,
              githubCredentials: DefaultGithubCredentialsProvider.fromIntegrations(
                ScmIntegrations.fromConfig(config),
              ),
              logger,
            }),
            httpAuth,
            permissions,
          }),
        );
      },
    });
  },
});

export default releaseVersionsModule;
