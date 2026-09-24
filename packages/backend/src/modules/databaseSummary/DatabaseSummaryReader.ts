import { CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';
import type { LoggerService } from '@backstage/backend-plugin-api';
import type { ReleaseVersionReader } from '../releaseVersions/ReleaseVersionReader';
import {
  READABLE_KINDS,
  readableKey,
  type BindingRelease,
  type DatabaseXr,
  type ManagedResource,
} from './DatabaseSummary';

export interface DatabaseObjects {
  xr: DatabaseXr;
  managed: ManagedResource[];
  releases: BindingRelease[];
}

// Reads one Database XR, the composed managed resources it references that
// are on the READABLE_KINDS allowlist (and nothing else — never Crossplane
// `Object`s, never Secrets), and the Releases binding it. Only namespaces in
// platformCatalog.namespaces are served, same scope as the entity provider
// that publishes these pages.
export class DatabaseSummaryReader {
  private readonly kubeConfig: KubeConfig;

  constructor(
    private readonly namespaces: string[],
    private readonly releases: ReleaseVersionReader,
    private readonly logger: LoggerService,
  ) {
    this.kubeConfig = new KubeConfig();
    this.kubeConfig.loadFromDefault();
  }

  // null: not found, or a namespace this portal doesn't serve.
  async read(namespace: string, name: string): Promise<DatabaseObjects | null> {
    if (!this.namespaces.includes(namespace)) {
      return null;
    }
    const api = this.kubeConfig.makeApiClient(CustomObjectsApi);

    let xr: DatabaseXr;
    try {
      xr = (await api.getNamespacedCustomObject({
        group: 'database.taskapp.io',
        version: 'v1alpha1',
        namespace,
        plural: 'databases',
        name,
      })) as DatabaseXr;
    } catch (err) {
      if ((err as { code?: number }).code === 404) {
        return null;
      }
      throw err;
    }

    const refs = (xr.spec?.crossplane?.resourceRefs ?? []).filter(
      r => r.name && READABLE_KINDS[readableKey(r.apiVersion, r.kind)],
    );
    const managed = (
      await Promise.all(
        refs.map(async ref => {
          const { group, plural } = READABLE_KINDS[readableKey(ref.apiVersion, ref.kind)];
          const version = (ref.apiVersion ?? '').split('/')[1];
          try {
            return (await api.getNamespacedCustomObject({
              group,
              version,
              namespace,
              plural,
              name: ref.name!,
            })) as ManagedResource;
          } catch (err) {
            this.logger.warn(
              `database-summary: failed to read ${ref.kind} ${namespace}/${ref.name} (${err instanceof Error ? err.message : String(err)})`,
            );
            return null;
          }
        }),
      )
    ).filter((m): m is ManagedResource => m !== null);

    const releases: BindingRelease[] = [];
    try {
      for (const r of await this.releases.listAll()) {
        if (!r.metadata?.name || r.metadata.namespace !== namespace) continue;
        for (const [bindingName, binding] of Object.entries(r.spec?.bindings ?? {})) {
          if (binding?.enabled && binding.ref === name) {
            releases.push({
              name: r.metadata.name,
              namespace,
              environment: r.spec?.environment ?? namespace,
              bindingName,
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `database-summary: failed to list Releases (${err instanceof Error ? err.message : String(err)})`,
      );
    }

    return { xr, managed, releases };
  }
}
