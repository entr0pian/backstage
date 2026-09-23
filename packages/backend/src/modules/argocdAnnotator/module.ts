import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { ArgoCdAnnotator } from './ArgoCdAnnotator';

// Registers ArgoCdAnnotator unconditionally — unlike platformEntityProvider,
// this has no Kubernetes/Argo CD dependency of its own (it only writes an
// annotation string derived from the entity's own name), so there's no
// config flag to gate it behind. The ArgoCD plugin's own tabs simply won't
// find anything to show until deployments.enabled wires up real ArgoCD
// connectivity — see BACKSTAGE_PART5.md.
export const argoCdAnnotatorModule = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'argocd-annotator',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
      },
      async init({ catalog }) {
        catalog.addProcessor(new ArgoCdAnnotator());
      },
    });
  },
});

export default argoCdAnnotatorModule;
