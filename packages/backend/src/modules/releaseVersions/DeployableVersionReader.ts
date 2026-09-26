import type {
  BackstageCredentials,
  LoggerService,
} from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import type { GithubCredentialsProvider } from '@backstage/integration';
import {
  mapWorkflowRuns,
  parseProjectSlug,
  type DeployableVersion,
  type WorkflowRun,
} from './DeployableVersionMapper';

// The scaffold's CI workflow file (platform-scaffolds golang-service,
// .github/workflows/ci.yaml) — the one that builds and pushes the image.
const CI_WORKFLOW = 'ci.yaml';
const MAX_VERSIONS = 30;

export interface DeployableVersionReaderOptions {
  catalog: CatalogService;
  githubCredentials: GithubCredentialsProvider;
  logger: LoggerService;
}

export type DeployableVersionsResult =
  | { status: 'ok'; repository: string; versions: DeployableVersion[] }
  | { status: 'not-found'; error: string };

// Deployable versions of one component, for the Create deployment
// template's Version picker (see DeployableVersionMapper for what
// "deployable" means). The repo comes from the Component entity's
// github.com/project-slug annotation, and GitHub is called with the
// backend's own integrations.github token — the browser never holds one.
export class DeployableVersionReader {
  private readonly catalog: CatalogService;
  private readonly githubCredentials: GithubCredentialsProvider;
  private readonly logger: LoggerService;

  constructor(options: DeployableVersionReaderOptions) {
    this.catalog = options.catalog;
    this.githubCredentials = options.githubCredentials;
    this.logger = options.logger;
  }

  async listForComponent(
    component: string,
    credentials: BackstageCredentials,
  ): Promise<DeployableVersionsResult> {
    const entity = await this.catalog.getEntityByRef(
      { kind: 'Component', namespace: 'default', name: component },
      { credentials },
    );
    if (!entity) {
      return { status: 'not-found', error: `Component ${component} not found in the catalog` };
    }

    const slug = entity.metadata.annotations?.['github.com/project-slug'];
    const repo = parseProjectSlug(slug);
    if (!repo) {
      return {
        status: 'not-found',
        error: `Component ${component} has no valid github.com/project-slug annotation`,
      };
    }

    const repoUrl = `https://github.com/${repo.owner}/${repo.repo}`;
    const { headers } = await this.githubCredentials.getCredentials({ url: repoUrl });
    const query = new URLSearchParams({
      branch: 'main',
      event: 'push',
      status: 'success',
      per_page: String(MAX_VERSIONS),
    });
    const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/workflows/${CI_WORKFLOW}/runs?${query}`;

    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json', ...headers },
    });

    // No ci.yaml workflow (e.g. a repo not scaffolded from golang-service)
    // means nothing was ever built — no deployable versions, not an error.
    if (res.status === 404) {
      this.logger.info(`deployable-versions: ${repoUrl} has no ${CI_WORKFLOW} workflow`);
      return { status: 'ok', repository: repoUrl, versions: [] };
    }
    if (!res.ok) {
      throw new Error(`GitHub workflow runs request for ${repoUrl} failed: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as { workflow_runs?: WorkflowRun[] };
    return {
      status: 'ok',
      repository: repoUrl,
      versions: mapWorkflowRuns(body.workflow_runs ?? []),
    };
  }
}
