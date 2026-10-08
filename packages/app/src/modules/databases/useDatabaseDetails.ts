import { useEffect, useState } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';

// Mirrors the backend's DatabaseSummary
// (packages/backend/src/modules/databaseSummary/DatabaseSummary.ts). Owner-only
// fields (`endpoint`, `message`s) are absent for guests — redacted server-side.
export interface DatabaseDetails {
  name: string;
  namespace: string;
  component: string | null;
  detailLevel: 'owner' | 'summary';
  createdAt: string | null;
  ready: boolean | null;
  synced: boolean | null;
  problem: string | null;
  spec: { dbName: string | null; size: string | null };
  engine: {
    engine: string | null;
    version: string | null;
    instanceClass: string | null;
    storageGb: number | null;
    status: string | null;
    availabilityZone: string | null;
    multiAz: boolean | null;
    encrypted: boolean | null;
  } | null;
  endpoint?: { address: string | null; port: number | null; arn: string | null; consoleUrl: string | null } | null;
  connection: { name: string; type: string | null; provider: string | null; key: string | null; ready: boolean | null }[];
  boundBy: { release: string; namespace: string; environment: string; mountPath: string }[];
  resources: {
    kind: string;
    apiGroup: string;
    name: string;
    source: 'observed' | 'inferred';
    ready: boolean | null;
    synced: boolean | null;
    reason: string | null;
    message?: string | null;
    note?: string;
  }[];
}

export type DatabaseDetailsState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'done'; details: DatabaseDetails };

// Polled, so a database coming up (or a Release binding it) shows without
// a reload: often while it isn't Ready yet, rarely once it is. The request
// reads only the management cluster's Kubernetes API, never GitHub.
const NOT_READY_MS = 10_000;
const READY_MS = 60_000;

export const nextPollMs = (details: DatabaseDetails | null) =>
  details?.ready === true ? READY_MS : NOT_READY_MS;

export function useDatabaseDetails(namespace: string, name: string): DatabaseDetailsState {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [state, setState] = useState<DatabaseDetailsState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: DatabaseDetails | null = null;
    setState({ status: 'loading' });

    const load = async () => {
      // A hidden tab skips the request and checks again later.
      if (typeof document === 'undefined' || !document.hidden) {
        try {
          const baseUrl = await discoveryApi.getBaseUrl('platform');
          const res = await fetchApi.fetch(
            `${baseUrl}/databases/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
          );
          if (!res.ok) {
            throw new Error(`Database details request failed: ${res.status} ${res.statusText}`);
          }
          last = await res.json();
          if (!cancelled) setState({ status: 'done', details: last! });
        } catch (error) {
          // A failed refresh keeps the last answer on screen; only a first
          // load that fails shows the error.
          if (!cancelled && !last) setState({ status: 'error', error: error as Error });
        }
      }
      if (!cancelled) {
        timer = setTimeout(load, nextPollMs(last));
      }
    };
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [discoveryApi, fetchApi, namespace, name]);

  return state;
}
