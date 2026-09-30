import { configApiRef, useApi } from '@backstage/core-plugin-api';

// The platform's environments in their configured order
// (app-config `platform.environments`, e.g. [management, dev, prod]) — the
// order every per-environment view lists them in.
export function useEnvironmentOrder(): string[] {
  return useApi(configApiRef).getOptionalStringArray('platform.environments') ?? [];
}

// Sorts environments by their configured order; ones not in the list (an
// environment removed from config but still deployed) go last, by name.
export function compareEnvironments(order: string[]) {
  const rank = (env: string) => {
    const i = order.indexOf(env);
    return i === -1 ? order.length : i;
  };
  return (a: string, b: string) => rank(a) - rank(b) || a.localeCompare(b);
}
