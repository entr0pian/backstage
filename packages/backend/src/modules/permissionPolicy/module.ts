import { createBackendModule } from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { PortfolioPermissionPolicy } from './policy';

// Replaces plugin-permission-backend-module-allow-all-policy: this portal
// is publicly reachable with guest sign-in, so visitors get read-only
// browsing and only the owner's GitHub sign-in can run templates, register
// locations, refresh/delete entities, etc. See policy.ts.
export const permissionPolicyModule = createBackendModule({
  pluginId: 'permission',
  moduleId: 'portfolio-policy',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy(new PortfolioPermissionPolicy());
      },
    });
  },
});

export default permissionPolicyModule;
