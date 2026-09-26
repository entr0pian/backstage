// Pure mapping for GET /api/platform/versions/:component — the Create
// deployment template's Version picker (platform-architecture DEPLOYMENTS.md
// Step 1). No I/O here, so it's unit-testable without GitHub.
//
// "Deployable" = a commit on main whose `ci` workflow run on push succeeded:
// the scaffold's CI (platform-scaffolds golang-service,
// .github/workflows/ci.yaml) only pushes the image, tagged with the full
// commit SHA, from a successful push to main. So a successful run is the
// image existing, and a Release's spec.version is that same SHA.

export interface DeployableVersion {
  // Full 40-char commit SHA — the image tag, and what the Release gets.
  sha: string;
  shortSha: string;
  // First line of the commit message only.
  message: string;
  author: string;
  // ISO timestamp of the commit's CI run.
  createdAt: string;
}

// The subset of GitHub's "list workflow runs" response we read.
export interface WorkflowRun {
  head_sha?: string;
  created_at?: string;
  head_commit?: {
    message?: string;
    author?: { name?: string };
  } | null;
  actor?: { login?: string } | null;
}

// "owner/repo" from the github.com/project-slug annotation every scaffolded
// Component carries (platform-scaffolds catalog-info.yaml).
export function parseProjectSlug(
  slug: string | undefined,
): { owner: string; repo: string } | undefined {
  const match = slug?.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
  return match ? { owner: match[1], repo: match[2] } : undefined;
}

// GitHub returns runs newest first; a re-run of the same commit is a second
// run with the same head_sha, so keep only the first (newest) per SHA.
export function mapWorkflowRuns(runs: WorkflowRun[]): DeployableVersion[] {
  const seen = new Set<string>();
  const versions: DeployableVersion[] = [];

  for (const run of runs) {
    const sha = run.head_sha;
    if (!sha || seen.has(sha)) {
      continue;
    }
    seen.add(sha);
    versions.push({
      sha,
      shortSha: sha.slice(0, 7),
      message: (run.head_commit?.message ?? '').split('\n')[0],
      author: run.head_commit?.author?.name ?? run.actor?.login ?? 'unknown',
      createdAt: run.created_at ?? '',
    });
  }

  return versions;
}
