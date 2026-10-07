import type { BackstageCredentials } from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import type { GithubCredentialsProvider } from '@backstage/integration';
import { parseProjectSlug } from '../releaseVersions/DeployableVersionMapper';
import {
  MIGRATIONS_DIR,
  committedSchemaPath,
  migrationChangesFromCompare,
  migrationNamesFromListing,
  parseCommittedSchemaVersion,
  type GitHubCompareFile,
  type GitHubContentEntry,
  type MigrationFileChange,
} from './SchemaChanges';

const GITOPS_REPO = { owner: 'entr0pian', repo: 'application-repositories', ref: 'main' };

export type MigrationChangesResult =
  | { status: 'ok'; repository: string; files: MigrationFileChange[] }
  | { status: 'not-found'; error: string };

// GitHub reads for database schemas, with the backend's own
// integrations.github token (the browser never holds one): the migration
// files in a component's repository, and the DatabaseSchema committed in
// application-repositories.
export class SchemaRepositoryReader {
  constructor(
    private readonly catalog: CatalogService,
    private readonly githubCredentials: GithubCredentialsProvider,
  ) {}

  private async repoOf(component: string, credentials: BackstageCredentials) {
    const entity = await this.catalog.getEntityByRef(
      { kind: 'Component', namespace: 'default', name: component },
      { credentials },
    );
    return parseProjectSlug(entity?.metadata.annotations?.['github.com/project-slug']);
  }

  private async get(url: string, repoUrl: string, accept = 'application/vnd.github+json'): Promise<Response> {
    const { headers } = await this.githubCredentials.getCredentials({ url: repoUrl });
    return fetch(url, { headers: { Accept: accept, ...headers } });
  }

  // Migration files that applying `head` changes compared with `base`, or,
  // with no base (nothing applied yet), every migration file at head.
  async changes(
    component: string,
    base: string | undefined,
    head: string,
    credentials: BackstageCredentials,
  ): Promise<MigrationChangesResult> {
    const repo = await this.repoOf(component, credentials);
    if (!repo) {
      return { status: 'not-found', error: `Component ${component} not found, or has no github.com/project-slug annotation` };
    }
    const repoUrl = `https://github.com/${repo.owner}/${repo.repo}`;
    const api = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;

    if (!base) {
      const names = await this.migrationNames(repo, head, repoUrl);
      return { status: 'ok', repository: repoUrl, files: names.map(name => ({ name, status: 'added' })) };
    }
    const res = await this.get(`${api}/compare/${base}...${head}`, repoUrl);
    if (res.status === 404) {
      return { status: 'not-found', error: `Can't compare ${base}...${head} in ${repoUrl}` };
    }
    if (!res.ok) {
      throw new Error(`GitHub compare request for ${repoUrl} failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { files?: GitHubCompareFile[] };
    return { status: 'ok', repository: repoUrl, files: migrationChangesFromCompare(body.files ?? []) };
  }

  // Migration file names in the component's repository at ref, in apply
  // order; empty when there is no migrations/ directory. For the deployment
  // card's code-ahead-of-schema warning.
  async migrationsAt(component: string, ref: string, credentials: BackstageCredentials): Promise<string[] | null> {
    const repo = await this.repoOf(component, credentials);
    if (!repo) {
      return null;
    }
    return this.migrationNames(repo, ref, `https://github.com/${repo.owner}/${repo.repo}`);
  }

  private async migrationNames(repo: { owner: string; repo: string }, ref: string, repoUrl: string): Promise<string[]> {
    const res = await this.get(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${MIGRATIONS_DIR}?ref=${encodeURIComponent(ref)}`,
      repoUrl,
    );
    if (res.status === 404) {
      return [];
    }
    if (!res.ok) {
      throw new Error(`GitHub contents request for ${repoUrl}/${MIGRATIONS_DIR} failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as GitHubContentEntry[] | unknown;
    return Array.isArray(body) ? migrationNamesFromListing(body as GitHubContentEntry[]) : [];
  }

  // spec.version of the DatabaseSchema committed on application-repositories'
  // main, null when the environment has none yet. What the Apply database
  // schema form starts from (git, not the cluster, which lags a merge).
  async committedVersion(component: string, environment: string): Promise<string | null> {
    const { owner, repo, ref } = GITOPS_REPO;
    const path = committedSchemaPath(component, environment);
    const res = await this.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
      `https://github.com/${owner}/${repo}`,
      'application/vnd.github.raw+json',
    );
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`GitHub contents request for ${owner}/${repo}/${path} failed: ${res.status} ${res.statusText}`);
    }
    return parseCommittedSchemaVersion(await res.text());
  }
}
