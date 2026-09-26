export interface Config {
  platform?: {
    /**
     * Browser-reachable Argo CD UI, for "Open in Argo CD" deep links on the
     * Deployments tab and Database page. Omit to hide those links.
     * @visibility frontend
     */
    argocdUiUrl?: string;
    /**
     * Environments a component can be deployed to — the Create deployment
     * template's Environment picker offers exactly these. Each is a
     * platform/environments/<env> folder in application-repositories.
     * @visibility frontend
     */
    environments?: string[];
  };
}
