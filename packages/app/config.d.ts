export interface Config {
  platform?: {
    /**
     * Browser-reachable Argo CD UI, for "Open in Argo CD" deep links on the
     * Deployments tab and Database page. Omit to hide those links.
     * @visibility frontend
     */
    argocdUiUrl?: string;
    /**
     * Browser-reachable Grafana, for the Metrics tab's "Open in Grafana"
     * deep links into Platform — Service Overview. Omit to hide them.
     * @visibility frontend
     */
    grafanaUiUrl?: string;
    /**
     * Backend only (never sent to the browser): cluster-internal Prometheus
     * the Metrics tab's fixed queries run against. Unset, the Metrics route
     * isn't registered.
     */
    observability?: {
      prometheusUrl?: string;
    };
    /**
     * Environments a component can be deployed to — the Create deployment
     * template's Environment picker offers exactly these. Each is a
     * platform/environments/<env> folder in application-repositories.
     * @visibility frontend
     */
    environments?: string[];
    /**
     * Backend only: folder of registered workload clusters, one
     * <env>/{clusterName,server,caData} per cluster, written by the chart's
     * ExternalSecrets. Unset: only the local cluster is used.
     */
    clustersDir?: string;
  };
}
