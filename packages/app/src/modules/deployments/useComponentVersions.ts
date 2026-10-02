import { useEffect, useRef, useState } from 'react';
import { discoveryApiRef, fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { missingShas, type DeployableVersion } from './whatChanged';

export interface ComponentVersions {
  repository: string | null;
  versions: DeployableVersion[];
}

// The component's deployable versions (commits on main with a built image)
// from our platform backend — the same route the Create deployment picker
// uses. Loaded once per component, and again only when a card needs a
// version that isn't in the list yet (`wanted`, i.e. right after a new
// deploy) — at most once per distinct set of missing SHAs, so a commit that
// is genuinely older than the list can't cause a refetch loop. Failures
// leave the list empty: cards still show the SHAs, just without messages.
export function useComponentVersions(component: string, wanted: (string | null | undefined)[]): ComponentVersions {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [state, setState] = useState<ComponentVersions>({ repository: null, versions: [] });
  const tried = useRef<string | null>(null);

  const missing = missingShas(wanted, state.versions).join(',');
  const loadKey = `${component}|${state.repository === null ? 'initial' : missing}`;

  useEffect(() => {
    if (tried.current === loadKey || (state.repository !== null && !missing)) {
      return undefined;
    }
    tried.current = loadKey;
    let cancelled = false;
    (async () => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl('platform');
        const res = await fetchApi.fetch(`${baseUrl}/versions/${encodeURIComponent(component)}`);
        if (!res.ok) return;
        const body: { repository?: string; versions?: DeployableVersion[] } = await res.json();
        if (!cancelled) {
          setState({ repository: body.repository ?? null, versions: body.versions ?? [] });
        }
      } catch {
        // Keep what we have; the cards degrade to bare SHAs.
      }
    })();
    return () => {
      cancelled = true;
    };
    // `loadKey` captures component + what's missing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryApi, fetchApi, loadKey]);

  return state;
}
