import type { GithubCredentialsProvider } from '@backstage/integration';
import { mapScaffoldTags, type GitRef } from './ScaffoldVersionMapper';

// Where scaffold-operator fetches templates from — the same repo the
// Component's spec.scaffold.version is resolved against.
const SCAFFOLDS_REPO = { owner: 'entr0pian', repo: 'platform-scaffolds' };

export interface ScaffoldVersions {
  // Newest first; empty when the scaffold has never been released.
  versions: string[];
  latest: string | null;
}

// Released versions of one platform-scaffolds template, read from its tags
// with the backend's own integrations.github token — the browser never
// holds one, and nobody has to know which tag is current.
export class ScaffoldVersionReader {
  private readonly githubCredentials: GithubCredentialsProvider;

  constructor(options: { githubCredentials: GithubCredentialsProvider }) {
    this.githubCredentials = options.githubCredentials;
  }

  async listForTemplate(template: string): Promise<ScaffoldVersions> {
    const { owner, repo } = SCAFFOLDS_REPO;
    const { headers } = await this.githubCredentials.getCredentials({
      url: `https://github.com/${owner}/${repo}`,
    });
    const url = `https://api.github.com/repos/${owner}/${repo}/git/matching-refs/tags/${template}/v?per_page=100`;

    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json', ...headers },
    });
    if (!res.ok) {
      throw new Error(`GitHub tags request for ${owner}/${repo} failed: ${res.status} ${res.statusText}`);
    }

    const versions = mapScaffoldTags(template, (await res.json()) as GitRef[]);
    return { versions, latest: versions[0] ?? null };
  }
}
