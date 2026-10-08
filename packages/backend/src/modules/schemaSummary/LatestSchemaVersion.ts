// The newest schema version a component has published (its newest green
// schema.yaml run on main), for the "is the latest schema applied?" check.
// /schemas is polled by every open deployment card and Dependencies view,
// so the answer is cached per component: a new schema version shows up
// within the TTL, and GitHub sees at most one request per component per TTL
// however many people are looking. Nothing in it is sensitive (a commit of
// the component's public repo), so one cache serves every caller.

export interface LatestSchema {
  version: string;
  createdAt: string | null;
}

// Newest first, as DeployableVersionReader returns them; null when the
// component isn't in the catalog.
export type LoadSchemaVersions = () => Promise<{ sha: string; createdAt: string | null }[] | null>;

const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES = 200;

export class LatestSchemaVersion {
  private readonly cache = new Map<string, { at: number; value: Promise<LatestSchema | null> }>();

  constructor(private readonly options: { ttlMs?: number; now?: () => number } = {}) {}

  // null when the component has published no schema yet, or GitHub can't be
  // reached: the caller then shows no "latest" rather than a wrong one.
  get(component: string, load: LoadSchemaVersions): Promise<LatestSchema | null> {
    const now = (this.options.now ?? Date.now)();
    const ttl = this.options.ttlMs ?? DEFAULT_TTL_MS;
    const hit = this.cache.get(component);
    if (hit && now - hit.at < ttl) {
      return hit.value;
    }
    const value = load().then(
      versions => (versions && versions.length > 0 ? { version: versions[0].sha, createdAt: versions[0].createdAt } : null),
      () => null,
    );
    this.cache.delete(component);
    if (this.cache.size >= MAX_ENTRIES) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
    this.cache.set(component, { at: now, value });
    return value;
  }
}
