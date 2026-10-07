// Pure mapping of GitHub responses to the migration files involved in a
// schema version: what applying `head` over `base` adds, for the Apply
// database schema form and its pull request. No I/O.

import { parse } from 'yaml';

export const MIGRATIONS_DIR = 'migrations';

export interface MigrationFileChange {
  // File name inside migrations/, e.g. 20261009093000_add_price.sql.
  name: string;
  // GitHub's file status: added, modified, removed, renamed, ...
  status: string;
}

// The subset of GitHub's compare API ("files") and contents API (directory
// listing) responses we read.
export interface GitHubCompareFile {
  filename?: string;
  status?: string;
}
export interface GitHubContentEntry {
  name?: string;
  type?: string;
}

const isMigration = (name: string) => /^\d+_.*\.sql$/.test(name);

// Migration files changed between two commits, in apply order. atlas.sum
// and anything outside migrations/ are left out.
export function migrationChangesFromCompare(files: GitHubCompareFile[]): MigrationFileChange[] {
  const prefix = `${MIGRATIONS_DIR}/`;
  return files
    .filter(f => f.filename?.startsWith(prefix))
    .map(f => ({ name: f.filename!.slice(prefix.length), status: f.status ?? 'modified' }))
    .filter(f => !f.name.includes('/') && isMigration(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Migration file names in a migrations/ directory listing, in apply order.
export function migrationNamesFromListing(entries: GitHubContentEntry[]): string[] {
  return entries
    .filter(e => e.type === 'file' && e.name && isMigration(e.name))
    .map(e => e.name!)
    .sort((a, b) => a.localeCompare(b));
}

// The DatabaseSchema committed in application-repositories for one
// component/environment, as the Apply database schema template writes it.
export function committedSchemaPath(component: string, environment: string): string {
  return `platform/environments/${environment}/${component}-db-schema.yaml`;
}

// spec.version of a committed DatabaseSchema manifest, or null when the file
// is absent or isn't one (the form then treats the environment as having no
// schema released yet).
export function parseCommittedSchemaVersion(manifest: string | null): string | null {
  if (!manifest) {
    return null;
  }
  try {
    const doc = parse(manifest) as { kind?: unknown; spec?: { version?: unknown } | null } | null;
    const version = doc?.spec?.version;
    return doc?.kind === 'DatabaseSchema' && typeof version === 'string' && /^[0-9a-f]{40}$/.test(version)
      ? version
      : null;
  } catch {
    return null;
  }
}
