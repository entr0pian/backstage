// Argo CD lookups and deep links shared by every platform view (Deployments
// tab, Details drawer, Database page), so they all find Applications the
// same way and link to them with one URL builder and one base URL.
//
// Applications are always found by the platform.taskapp.io/* label
// contract that taskapp-catalog and taskapp-platform stamp on them — never
// by Application name (see BACKSTAGE_PART6.md "Deployment correlation"),
// through the installed Argo CD plugin backend, never a second Argo client.
import { useEffect, useState } from 'react';
import {
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
  useApi,
  type DiscoveryApi,
  type FetchApi,
} from '@backstage/frontend-plugin-api';

export const PLATFORM_LABELS = {
  component: 'platform.taskapp.io/component',
  environment: 'platform.taskapp.io/environment',
  // service (taskapp-catalog), component / database / release
  // (taskapp-platform — the CR kind it delivers)
  type: 'platform.taskapp.io/type',
  // What the Application delivers: the service (taskapp-catalog) or the
  // CR's own name (taskapp-platform)
  name: 'platform.taskapp.io/name',
} as const;

export type PlatformSelector = Partial<Record<keyof typeof PLATFORM_LABELS, string>>;

export function platformSelector(selector: PlatformSelector): string {
  return (Object.keys(PLATFORM_LABELS) as (keyof typeof PLATFORM_LABELS)[])
    .filter(key => selector[key])
    .map(key => `${PLATFORM_LABELS[key]}=${selector[key]}`)
    .join(',');
}

// Throws on network errors; a non-OK response is returned as `ok: false` so
// callers can keep rendering without Argo CD (BACKSTAGE_PART5.md's "Argo
// unavailable" behavior).
export async function fetchArgoApplications<T>(
  discoveryApi: DiscoveryApi,
  fetchApi: FetchApi,
  selector: PlatformSelector,
): Promise<{ ok: boolean; items: T[] }> {
  const baseUrl = await discoveryApi.getBaseUrl('backstage-community-argocd');
  const res = await fetchApi.fetch(
    `${baseUrl}/argoInstance/primary/applications/selector/${encodeURIComponent(platformSelector(selector))}`,
  );
  if (!res.ok) return { ok: false, items: [] };
  const body: { items?: T[] } = await res.json();
  return { ok: true, items: body.items ?? [] };
}

export interface ArgoApplicationRef {
  name: string | null | undefined;
  // Argo CD's own namespace when unset.
  namespace?: string | null;
}

// The single Application matching a selector, or null (none, several, or
// Argo CD unreachable — the view then just has no Argo CD link).
export function useArgoApplication(selector: PlatformSelector | null): ArgoApplicationRef | null {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const key = selector ? platformSelector(selector) : '';
  const [app, setApp] = useState<ArgoApplicationRef | null>(null);

  useEffect(() => {
    if (!selector) return undefined;
    let cancelled = false;
    fetchArgoApplications<{ metadata?: { name?: string; namespace?: string } }>(
      discoveryApi,
      fetchApi,
      selector,
    )
      .then(({ items }) => {
        if (cancelled) return;
        setApp(
          items.length === 1
            ? { name: items[0].metadata?.name, namespace: items[0].metadata?.namespace }
            : null,
        );
      })
      .catch(() => !cancelled && setApp(null));
    return () => {
      cancelled = true;
    };
    // `key` is the selector's stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryApi, fetchApi, key]);

  return app;
}

// Browser-reachable Argo CD UI (app-config `platform.argocdUiUrl`) — not
// argocd-backend's in-cluster URL. Undefined hides every "Open in Argo CD"
// link.
export function useArgocdUiUrl(): string | undefined {
  return useApi(configApiRef).getOptionalString('platform.argocdUiUrl');
}

export function argoApplicationUrl(
  uiUrl: string | undefined,
  app: ArgoApplicationRef | null,
): string | null {
  if (!uiUrl || !app?.name) {
    return null;
  }
  const base = uiUrl.replace(/\/+$/, '');
  const namespace = app.namespace ?? 'argocd';
  return `${base}/applications/${encodeURIComponent(namespace)}/${encodeURIComponent(app.name)}`;
}
