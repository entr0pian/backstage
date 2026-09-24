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

export function useDatabaseDetails(namespace: string, name: string): DatabaseDetailsState {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [state, setState] = useState<DatabaseDetailsState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ status: 'loading' });
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(
          `${baseUrl}/databases/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
        );
        if (!res.ok) {
          throw new Error(`Database details request failed: ${res.status} ${res.statusText}`);
        }
        const details: DatabaseDetails = await res.json();
        if (!cancelled) setState({ status: 'done', details });
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error: error as Error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi, fetchApi, namespace, name]);

  return state;
}
