import type { GithubCredentialsProvider } from '@backstage/integration';
import {
  committedReleasePath,
  parseCommittedRelease,
  type CommittedRelease,
} from './CommittedReleaseMapper';

// Where every Release manifest is committed (and what the Create deployment
// template opens its PRs against).
const GITOPS_REPO = { owner: 'entr0pian', repo: 'application-repositories', ref: 'main' };

// The Release for one component/environment as committed on main — not the
// in-cluster copy, which lags a merge until Argo CD syncs it and doesn't
// exist at all before the first sync. The Create deployment form starts
// from this, so its Auto-deploy toggle shows what's actually in git.
export class CommittedReleaseReader {
  private readonly githubCredentials: GithubCredentialsProvider;

  constructor(options: { githubCredentials: GithubCredentialsProvider }) {
    this.githubCredentials = options.githubCredentials;
  }

  async read(component: string, environment: string): Promise<CommittedRelease> {
    const { owner, repo, ref } = GITOPS_REPO;
    const { headers } = await this.githubCredentials.getCredentials({
      url: `https://github.com/${owner}/${repo}`,
    });
    const path = committedReleasePath(component, environment);
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;

    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github.raw+json', ...headers },
    });
    if (res.status === 404) {
      return parseCommittedRelease(null);
    }
    if (!res.ok) {
      throw new Error(`GitHub contents request for ${owner}/${repo}/${path} failed: ${res.status} ${res.statusText}`);
    }
    return parseCommittedRelease(await res.text());
  }
}
