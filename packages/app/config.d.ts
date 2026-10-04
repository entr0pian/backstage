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
     * Backend only (never sent to the browser): the Prometheus-compatible
     * query API the Metrics tab's fixed queries run against. Unset, the
     * Metrics route isn't registered.
     */
    observability?: {
      /**
       * Base URL that /api/v1/query is appended to, e.g. Mimir's
       * http://mimir-query-frontend.mimir.svc.cluster.local:8080/prometheus
       * or a plain Prometheus' http://localhost:9090.
       */
      prometheusUrl?: string;
      /**
       * Mimir tenant, sent as X-Scope-OrgID on every query. Omit for a
       * plain Prometheus.
       */
      tenant?: string;
    };
    /**
     * Environments a component can be deployed to — the Create deployment
     * template's Environment picker offers exactly these. Each is a
     * platform/environments/<env> folder in application-repositories.
     * @visibility frontend
     */
    environments?: string[];
    /**
     * Environments where a Release may follow main instead of a pinned
     * version (the Create deployment template's Auto-deploy toggle; greyed
     * out everywhere else). Must match release-operator's
     * --auto-deploy-environments, which enforces it. Defaults to ["dev"].
     * @visibility frontend
     */
    autoDeployEnvironments?: string[];
    /**
     * Backend only: folder of registered workload clusters, one
     * <env>/{clusterName,server,caData} per cluster, written by the chart's
     * ExternalSecrets. Unset: only the local cluster is used.
     */
    clustersDir?: string;
  };
}
