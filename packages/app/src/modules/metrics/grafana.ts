import { configApiRef, useApi } from '@backstage/core-plugin-api';

// uid of Platform — Service Overview (helm-charts/platform/dashboards/
// platform-service-overview.json). Its component/environment template
// variables are what the deep link preselects.
export const SERVICE_OVERVIEW_DASHBOARD_UID = 'platform-service-overview';

// Browser-reachable Grafana (app-config `platform.grafanaUiUrl`). Undefined
// hides every "Open in Grafana" link.
export function useGrafanaUiUrl(): string | undefined {
  return useApi(configApiRef).getOptionalString('platform.grafanaUiUrl');
}

export function serviceOverviewUrl(
  uiUrl: string | undefined,
  component: string,
  environment: string,
): string | null {
  if (!uiUrl) {
    return null;
  }
  const params = new URLSearchParams({
    'var-component': component,
    'var-environment': environment,
  });
  return `${uiUrl.replace(/\/+$/, '')}/d/${SERVICE_OVERVIEW_DASHBOARD_UID}?${params}`;
}
