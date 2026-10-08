import { useEffect, useState } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';

// Mirrors the backend's SchemaSummary + CodeSchemaCheck
// (packages/backend/src/modules/schemaSummary/SchemaSummary.ts). Optional
// `message` fields are owner-only: the backend leaves them out for guests.
export type SchemaPhase = 'Pending' | 'Migrating' | 'Applied' | 'Failed';

export interface SchemaStatus {
  requested: {
    name: string;
    namespace: string;
    version: string;
    // The Database it applies to; null until schema-operator resolves it
    // (and no databaseRef names one).
    database: string | null;
    published: boolean | null;
    reason: string | null;
    message?: string | null;
  } | null;
  applied: {
    name: string;
    namespace: string;
    commit: string | null;
    phase: SchemaPhase;
    lastAppliedVersion: string | null;
    appliedAt: string | null;
    reason: string | null;
    message?: string | null;
  } | null;
  code: { version: string; newestMigration: string | null; ahead: boolean } | null;
  // The newest schema version the component has published; null when none
  // has been, or GitHub couldn't be asked.
  latest: { version: string; createdAt: string | null } | null;
}

// Faster while something is changing, like the rollout card's polling.
const ACTIVE_MS = 5_000;
const IDLE_MS = 30_000;

const isSettled = (s: SchemaStatus | null) =>
  !s || ((s.applied?.phase === 'Applied' || s.applied?.phase === 'Failed') &&
    (!s.requested || s.requested.version === s.applied?.commit));

// One environment's database schema, from GET /api/platform/schemas. null
// until loaded, and when the request fails: the card then shows no schema
// section rather than a wrong one.
export function useSchemaStatus(component: string, environment: string): SchemaStatus | null {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [status, setStatus] = useState<SchemaStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: SchemaStatus | null = null;

    const load = async () => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(
          `${baseUrl}/schemas/${encodeURIComponent(component)}/${encodeURIComponent(environment)}`,
        );
        last = res.ok ? ((await res.json()) as SchemaStatus) : null;
      } catch {
        last = null;
      }
      if (!cancelled) {
        setStatus(last);
        timer = setTimeout(load, isSettled(last) ? IDLE_MS : ACTIVE_MS);
      }
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [discoveryApi, fetchApi, component, environment]);

  return status;
}
