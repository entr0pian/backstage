import Router from 'express-promise-router';
import type { Router as ExpressRouter } from 'express';
import type { ReleaseVersionReader } from './ReleaseVersionReader';

// GET /api/platform/releases/:component -> { component, releases: [...] }.
// A component with no matching Release CRs returns releases: [] with a 200,
// not a 404 — "no deployments yet" is normal platform state, not an error,
// same rule BACKSTAGE_PART5.md's original spec set for the fuller design
// this replaces.
export function createRouter(reader: ReleaseVersionReader): ExpressRouter {
  const router = Router();

  router.get('/releases/:component', async (req, res) => {
    const { component } = req.params;
    const releases = await reader.listForComponent(component);
    res.json({ component, releases });
  });

  return router;
}
