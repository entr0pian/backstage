// Pure: which schema versions the Apply database schema form offers.

// Mirrors the backend's DeployableVersion (modules/releaseVersions), here
// from the schema workflow.
export interface SchemaVersion {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  createdAt: string;
}

export interface SchemaVersionOption {
  version: SchemaVersion;
  // Shown next to the entry: why it can't be chosen.
  label: 'current' | 'older' | null;
  selectable: boolean;
}

// versions are newest first (the order of their schema workflow runs). The
// platform migrates forward only, so the environment's current version and
// everything older than it can't be chosen. A current version that isn't in
// the list (older than the oldest shown, or never published) leaves every
// listed version selectable.
export function schemaVersionOptions(versions: SchemaVersion[], current: string | null): SchemaVersionOption[] {
  const currentIndex = current ? versions.findIndex(v => v.sha === current) : -1;
  return versions.map((version, index) => {
    if (currentIndex === -1 || index < currentIndex) {
      return { version, label: null, selectable: true };
    }
    return { version, label: index === currentIndex ? 'current' : 'older', selectable: false };
  });
}
