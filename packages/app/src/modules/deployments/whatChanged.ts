// Pure: what an environment's current deployment changed — the target
// version's commit, the version it replaced, and a GitHub compare link
// between them. Commit details come from the component's deployable
// versions (GET /api/platform/versions/:component: commits on main with a
// built image, newest first). No I/O here; see useComponentVersions.ts.
import type { DeploymentProgress } from './useEnvironmentDetails';

export interface DeployableVersion {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  createdAt: string;
}

export interface CommitRef {
  sha: string;
  shortSha: string;
  url: string | null;
  // Absent when the commit is older than the versions list reaches.
  message: string | null;
  author: string | null;
  createdAt: string | null;
}

export interface WhatChanged {
  target: CommitRef;
  // The version this deployment replaces; null on a first deployment.
  previous: CommitRef | null;
  // Same version, new revision (e.g. a binding toggled): nothing to compare.
  configurationOnly: boolean;
  compareUrl: string | null;
}

const SHA = /^[0-9a-f]{40}$/;

function commitRef(sha: string, versions: DeployableVersion[], repository: string | null): CommitRef {
  const known = versions.find(v => v.sha === sha);
  return {
    sha,
    shortSha: SHA.test(sha) ? sha.slice(0, 7) : sha,
    url: repository && SHA.test(sha) ? `${repository}/commit/${sha}` : null,
    message: known?.message ?? null,
    author: known?.author ?? null,
    createdAt: known?.createdAt ?? null,
  };
}

// Target = the Release's version (what is being, or has been, deployed).
// Previous = the version the rollout replaces (while Pending: what still runs).
export function whatChanged(
  progress: Pick<DeploymentProgress, 'targetVersion' | 'previous'>,
  versions: DeployableVersion[],
  repository: string | null,
): WhatChanged | null {
  const targetSha = progress.targetVersion;
  if (!targetSha) {
    return null;
  }
  const previousSha = progress.previous?.version ?? null;
  const configurationOnly = previousSha === targetSha;
  const previous = previousSha && !configurationOnly ? commitRef(previousSha, versions, repository) : null;
  return {
    target: commitRef(targetSha, versions, repository),
    previous,
    configurationOnly,
    compareUrl:
      repository && previous && SHA.test(previous.sha) && SHA.test(targetSha)
        ? `${repository}/compare/${previous.sha}...${targetSha}`
        : null,
  };
}

// The SHAs a set of cards needs details for — the versions fetch is only
// repeated when one of these isn't known yet (i.e. after a new deploy).
export function missingShas(wanted: (string | null | undefined)[], versions: DeployableVersion[]): string[] {
  const known = new Set(versions.map(v => v.sha));
  return [...new Set(wanted.filter((s): s is string => !!s && SHA.test(s) && !known.has(s)))].sort();
}
