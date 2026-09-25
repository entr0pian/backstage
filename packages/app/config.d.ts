export interface Config {
  platform?: {
    /**
     * Browser-reachable Argo CD UI, for "Open in Argo CD" deep links on the
     * Deployments tab and Database page. Omit to hide those links.
     * @visibility frontend
     */
    argocdUiUrl?: string;
  };
}
