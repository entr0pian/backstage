import Router from 'express-promise-router';
import type { Router as ExpressRouter } from 'express';
import type {
  HttpAuthService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { kubernetesResourcesReadPermission } from '@backstage/plugin-kubernetes-common';
import type { ReleaseVersionReader } from './ReleaseVersionReader';
import type { EnvironmentSummaryReader } from '../environmentSummary/EnvironmentSummaryReader';
import { buildEnvironmentSummary } from '../environmentSummary/EnvironmentSummary';

// GET /api/platform/releases/:component -> { component, releases: [...] }.
// A component with no matching Release CRs returns releases: [] with a 200,
// not a 404 — "no deployments yet" is normal platform state, not an error,
// same rule BACKSTAGE_PART5.md's original spec set for the fuller design
// this replaces.
export function createRouter(options: {
  reader: ReleaseVersionReader;
  environments: EnvironmentSummaryReader;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
}): ExpressRouter {
  const { reader, environments, httpAuth, permissions } = options;
  const router = Router();

  router.get('/releases/:component', async (req, res) => {
    const { component } = req.params;
    const releases = await reader.listForComponent(component);
    res.json({ component, releases });
  });

  // GET /api/platform/environments/:component/:environment -> one
  // environment's Details summary (BACKSTAGE_PART9.md Part A). Guest-safe
  // by default; fields that can leak runtime detail (event messages,
  // ExternalSecret error messages) are only included when the CALLER may
  // read Kubernetes resources — decided here, server-side, via the same
  // permission the Kubernetes plugin uses (owner only, see
  // modules/permissionPolicy). The UI never gets data it then hides.
  router.get('/environments/:component/:environment', async (req, res) => {
    const { component, environment } = req.params;
    const credentials = await httpAuth.credentials(req);
    const [decision] = await permissions.authorize(
      [{ permission: kubernetesResourcesReadPermission }],
      { credentials },
    );
    const objects = await environments.read(component, environment);
    res.json(
      buildEnvironmentSummary(component, environment, objects, {
        includeSensitive: decision.result === AuthorizeResult.ALLOW,
      }),
    );
  });

  return router;
}
