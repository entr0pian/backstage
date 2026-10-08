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
import type { DeployableVersionReader } from './DeployableVersionReader';
import type { CommittedReleaseReader } from './CommittedReleaseReader';
import { isValidName } from './CommittedReleaseMapper';
import type { ScaffoldVersionReader } from '../scaffoldVersions/ScaffoldVersionReader';
import { isValidScaffoldName } from '../scaffoldVersions/ScaffoldVersionMapper';
import type { SchemaReader } from '../schemaSummary/SchemaReader';
import type { SchemaRepositoryReader } from '../schemaSummary/SchemaRepositoryReader';
import { buildSchemaSummary, codeSchemaCheck, type CodeSchemaCheck } from '../schemaSummary/SchemaSummary';
import { LatestSchemaVersion } from '../schemaSummary/LatestSchemaVersion';

const COMMIT_SHA = /^[0-9a-f]{40}$/;

// GET /api/platform/releases/:component -> { component, releases: [...] }.
// A component with no matching Release CRs returns releases: [] with a 200,
// not a 404 — "no deployments yet" is normal platform state, not an error,
// same rule BACKSTAGE_PART5.md's original spec set for the fuller design
// this replaces.
export function createRouter(options: {
  reader: ReleaseVersionReader;
  environments: EnvironmentSummaryReader;
  databases: DatabaseSummaryReader;
  versions: DeployableVersionReader;
  committed: CommittedReleaseReader;
  scaffolds: ScaffoldVersionReader;
  schemaVersions: DeployableVersionReader;
  schemas: SchemaReader;
  schemaRepos: SchemaRepositoryReader;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
}): ExpressRouter {
  const {
    reader,
    environments,
    databases,
    versions,
    committed,
    scaffolds,
    schemaVersions,
    schemas,
    schemaRepos,
    httpAuth,
    permissions,
  } = options;
  const router = Router();
  const latestSchemas = new LatestSchemaVersion();

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

  // GET /api/platform/versions/:component -> { component, repository,
  // versions: [...] }, newest first — commits on main with a built image,
  // for the Create deployment template's Version picker (DEPLOYMENTS.md
  // Step 1). Nothing sensitive: commit SHA/message/author of the
  // component's own repo.
  router.get('/versions/:component', async (req, res) => {
    const { component } = req.params;
    const credentials = await httpAuth.credentials(req);
    const result = await versions.listForComponent(component, credentials);
    if (result.status === 'not-found') {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ component, repository: result.repository, versions: result.versions });
  });

  // GET /api/platform/committed-releases/:component/:environment ->
  // { component, environment, exists, autoDeploy, version, bindings } — the
  // Release manifest as committed on application-repositories' main, for
  // the Create deployment form to start from (its Auto-deploy toggle shows
  // what's in git, not a default). Nothing sensitive: the same file is in
  // the GitOps repo.
  router.get('/committed-releases/:component/:environment', async (req, res) => {
    const { component, environment } = req.params;
    if (!isValidName(component) || !isValidName(environment)) {
      res.status(400).json({ error: `Invalid component or environment name: ${component}/${environment}` });
      return;
    }
    res.json({ component, environment, ...(await committed.read(component, environment)) });
  });

  // GET /api/platform/scaffolds/:template/versions -> { template, latest,
  // versions: [...] }, newest first — released platform-scaffolds versions
  // of one template, for the Onboard Service template's Scaffold version
  // picker (defaults to latest). Nothing sensitive: public release tags.
  router.get('/scaffolds/:template/versions', async (req, res) => {
    const { template } = req.params;
    if (!isValidScaffoldName(template)) {
      res.status(400).json({ error: `Invalid scaffold template name: ${template}` });
      return;
    }
    res.json({ template, ...(await scaffolds.listForTemplate(template)) });
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

  // GET /api/platform/schema-versions/:component -> { component,
  // repository, versions: [...] }, newest first — commits on main whose
  // schema workflow succeeded, i.e. whose schema package was published, for
  // the Apply database schema template's Version picker. Same shape and
  // rules as /versions (ci.yaml), from schema.yaml. Nothing sensitive.
  router.get('/schema-versions/:component', async (req, res) => {
    const { component } = req.params;
    if (!isValidName(component)) {
      res.status(400).json({ error: `Invalid component name: ${component}` });
      return;
    }
    const credentials = await httpAuth.credentials(req);
    const result = await schemaVersions.listForComponent(component, credentials);
    if (result.status === 'not-found') {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ component, repository: result.repository, versions: result.versions });
  });

  // GET /api/platform/schemas/:component/:environment[?committed=1] ->
  // { component, environment, requested, applied, code, latest[, committedVersion] }:
  // the DatabaseSchema on management, the AtlasMigration on the workload
  // cluster (whether it was applied), whether the code the Release
  // deploys expects a migration the database doesn't have yet, and the
  // newest schema version the component has published (cached, see
  // LatestSchemaVersion), so callers can tell whether it's the one applied. With
  // committed=1 (the Apply database schema form), also the DatabaseSchema
  // version committed in git; the polling deployment card leaves it out.
  // Atlas's condition messages (the failing SQL and database error) are
  // owner-only, decided here like the environment summary's.
  router.get('/schemas/:component/:environment', async (req, res) => {
    const { component, environment } = req.params;
    if (!isValidName(component) || !isValidName(environment)) {
      res.status(400).json({ error: `Invalid component or environment name: ${component}/${environment}` });
      return;
    }
    const includeSensitive = await mayReadSensitive(req);
    const credentials = await httpAuth.credentials(req);
    const [committedVersion, objects, releases, latest] = await Promise.all([
      req.query.committed ? schemaRepos.committedVersion(component, environment) : Promise.resolve(undefined),
      schemas.read(component, environment),
      reader.listAll(),
      latestSchemas.get(component, async () => {
        const result = await schemaVersions.listForComponent(component, credentials);
        return result.status === 'ok' ? result.versions : null;
      }),
    ]);
    const summary = buildSchemaSummary(objects.databaseSchema, objects.atlasMigration, { includeSensitive });

    let code: CodeSchemaCheck | null = null;
    const release = releases.find(
      r => r.spec?.componentRef?.name === component && r.spec?.environment === environment,
    );
    const version = release?.spec?.version;
    // Checked once a schema is released here, or as soon as the Release binds
    // a database: the code then expects tables, even before any schema.
    const bindsDatabase = Boolean(release?.spec?.bindings?.database?.enabled);
    if (version && COMMIT_SHA.test(version) && (summary.requested || summary.applied || bindsDatabase)) {
      try {
        const files = await schemaRepos.migrationsAt(component, version, credentials);
        code = files ? codeSchemaCheck(version, files, summary.applied) : null;
      } catch {
        code = null; // GitHub unavailable: no warning rather than a wrong one
      }
    }
    res.json({
      component,
      environment,
      ...(committedVersion !== undefined ? { committedVersion } : {}),
      ...summary,
      code,
      latest,
    });
  });

  // GET /api/platform/schema-changes/:component?head=<sha>[&base=<sha>] ->
  // { component, repository, files: [{name, status}] }: the migration files
  // applying head changes over base (every file at head without a base), for
  // the Apply database schema form and its pull request. Nothing sensitive:
  // file names in the component's own repo.
  router.get('/schema-changes/:component', async (req, res) => {
    const { component } = req.params;
    const head = String(req.query.head ?? '');
    const base = req.query.base ? String(req.query.base) : undefined;
    if (!isValidName(component) || !COMMIT_SHA.test(head) || (base !== undefined && !COMMIT_SHA.test(base))) {
      res.status(400).json({ error: 'Expected a component name, head=<commit sha> and optionally base=<commit sha>' });
      return;
    }
    const credentials = await httpAuth.credentials(req);
    const result = await schemaRepos.changes(component, base, head, credentials);
    if (result.status === 'not-found') {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ component, repository: result.repository, files: result.files });
  });

  return router;
}
