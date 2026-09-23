/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));

// scaffolder plugin
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);

// techdocs plugin
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
// See https://backstage.io/docs/auth/guest/provider
// Owner sign-in — only registered when auth.providers.github is configured
// (the chart's githubAuth block); the resolver only accepts GitHub users
// with a matching User entity, i.e. org-data/users.yaml.
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
// GitHub discovery — finds catalog-info.yaml in entr0pian repositories, see
// catalog.providers.github in app-config.yaml (BACKSTAGE_PART2.md milestone)
backend.add(import('@backstage/plugin-catalog-backend-module-github'));

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// Platform Entity Provider — discovers Database CRs from the cluster and
// publishes them as catalog Resource entities, related to their owning
// Component via spec.componentRef. See BACKSTAGE_PART4.md and
// modules/platformEntityProvider/. Independent of, and does not modify,
// the GitHub-based Component discovery above.
backend.add(import('./modules/platformEntityProvider/module'));

// Stamps argocd/app-selector onto every Component entity as it's ingested
// (derived from the entity's own name — never hand-authored per repo). See
// BACKSTAGE_PART5.md's "Annotations" section and modules/argocdAnnotator/.
backend.add(import('./modules/argocdAnnotator/module'));

// Argo CD plugin backend — sync/health/revision per Application, discovered
// via the argocd/app-selector annotation above. See BACKSTAGE_PART5.md.
backend.add(import('@backstage-community/plugin-argocd-backend'));

// Release Versions — exposes GET /api/platform/releases/:component, reading
// Release CRs (platform.taskapp.io/v1alpha1) independently of the Argo CD
// plugin above. See BACKSTAGE_PART5.md Step 2 and
// modules/releaseVersions/.
backend.add(import('./modules/releaseVersions/module'));

// permission plugin — guests browse read-only, only the owner can act.
// See modules/permissionPolicy/.
backend.add(import('@backstage/plugin-permission-backend'));
backend.add(import('./modules/permissionPolicy/module'));

// search plugin
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// kubernetes plugin
backend.add(import('@backstage/plugin-kubernetes-backend'));

// user settings plugin
backend.add(import('@backstage/plugin-user-settings-backend'));

// notifications and signals plugins
backend.add(import('@backstage/plugin-notifications-backend'));
backend.add(import('@backstage/plugin-signals-backend'));

// mcp actions plugin
backend.add(import('@backstage/plugin-mcp-actions-backend'));

backend.start();
