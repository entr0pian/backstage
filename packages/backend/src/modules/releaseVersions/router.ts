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
import type { DatabaseSummaryReader } from '../databaseSummary/DatabaseSummaryReader';
import { buildDatabaseSummary } from '../databaseSummary/DatabaseSummary';

// GET /api/platform/releases/:component -> { component, releases: [...] }.
// A component with no matching Release CRs returns releases: [] with a 200,
// not a 404 — "no deployments yet" is normal platform state, not an error,
// same rule BACKSTAGE_PART5.md's original spec set for the fuller design
// this replaces.
export function createRouter(options: {
  reader: ReleaseVersionReader;
  environments: EnvironmentSummaryReader;
  databases: DatabaseSummaryReader;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
}): ExpressRouter {
  const { reader, environments, databases, httpAuth, permissions } = options;
  const router = Router();

  // Owner-only detail is decided per request, server-side, by whether the
  // caller may read Kubernetes resources (owner only, modules/permissionPolicy).
  const mayReadSensitive = async (req: Parameters<HttpAuthService['credentials']>[0]) => {
    const credentials = await httpAuth.credentials(req);
    const [decision] = await permissions.authorize(
      [{ permission: kubernetesResourcesReadPermission }],
      { credentials },
    );
    return decision.result === AuthorizeResult.ALLOW;
  };

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
    const includeSensitive = await mayReadSensitive(req);
    const objects = await environments.read(component, environment);
    res.json(buildEnvironmentSummary(component, environment, objects, { includeSensitive }));
  });

  // GET /api/platform/databases/:namespace/:name -> the Database page
  // summary (BACKSTAGE_PART9.md Part B). Same guest/owner split: endpoint,
  // ARN, console link and raw provider errors are owner-only.
  router.get('/databases/:namespace/:name', async (req, res) => {
    const { namespace, name } = req.params;
    const includeSensitive = await mayReadSensitive(req);
    const objects = await databases.read(namespace, name);
    if (!objects) {
      res.status(404).json({ error: `Database ${namespace}/${name} not found` });
      return;
    }
    res.json(buildDatabaseSummary(objects.xr, objects.managed, objects.releases, { includeSensitive }));
  });

  return router;
}
