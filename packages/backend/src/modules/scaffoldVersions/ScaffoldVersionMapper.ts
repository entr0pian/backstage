// Pure mapping for GET /api/platform/scaffolds/:template/versions — the
// Onboard Service template's Scaffold version picker. No I/O here, so it's
// unit-testable without GitHub.
//
// platform-scaffolds releases every scaffold independently as an immutable
// tag `<scaffold-name>/v<version>` (its README's "Versioning" section), so
// one scaffold's versions are exactly its prefixed tags, and each scaffold
// has its own latest.

// The subset of GitHub's "list matching references" response we read.
export interface GitRef {
  ref?: string;
}

// Plain MAJOR.MINOR.PATCH only — the form Component's spec.scaffold.version
// takes. Anything else under the prefix (pre-releases, typos) is skipped
// rather than offered.
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

// Scaffold names are platform-scaffolds' templates/<name> directories.
export function isValidScaffoldName(name: string): boolean {
  return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name);
}

// Versions of `template`, newest first by SemVer — not by GitHub's order,
// which is lexical (0.10.0 would sort before 0.9.0).
export function mapScaffoldTags(template: string, refs: GitRef[]): string[] {
  const prefix = `refs/tags/${template}/v`;
  const versions = new Set<string>();

  for (const { ref } of refs) {
    if (!ref?.startsWith(prefix)) {
      continue;
    }
    const version = ref.slice(prefix.length);
    if (SEMVER.test(version)) {
      versions.add(version);
    }
  }

  const parts = (v: string) => v.split('.').map(Number);
  return [...versions].sort((a, b) => {
    const [pa, pb] = [parts(a), parts(b)];
    return pb[0] - pa[0] || pb[1] - pa[1] || pb[2] - pa[2];
  });
}
