import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { kubernetesClusterSupplierExtensionPoint } from '@backstage/plugin-kubernetes-node';
import { RemoteClusters, toClusterDetails } from './RemoteClusters';

// Adds the registered workload clusters (RemoteClusters) to the Kubernetes
// plugin's clusters from config (the local one), so the Deployments tab's
// Logs finds a component's pods on whichever cluster its environment runs.
export const platformClustersModule = createBackendModule({
  pluginId: 'kubernetes',
  moduleId: 'platform-clusters',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        clusters: kubernetesClusterSupplierExtensionPoint,
      },
      async init({ config, clusters }) {
        const remote = RemoteClusters.fromConfig(config);
        clusters.addClusterSupplier(async ({ getDefault }) => {
          const local = await getDefault();
          return {
            async getClusters(options) {
              return [
                ...(await local.getClusters(options)),
                ...remote.list().map(toClusterDetails),
              ];
            },
          };
        });
      },
    });
  },
});

export default platformClustersModule;
