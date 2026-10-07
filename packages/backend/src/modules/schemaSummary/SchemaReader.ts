import { CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';
import type { LoggerService } from '@backstage/backend-plugin-api';
import type { ClusterKubeConfigs } from '../platformClusters/ClusterKubeConfigs';
import type { DatabaseSchemaResource, K8sAtlasMigration } from './SchemaSummary';

export interface SchemaObjects {
  databaseSchema: DatabaseSchemaResource | null;
  atlasMigration: K8sAtlasMigration | null;
}

// Reads one component's database schema in one environment: the
// DatabaseSchema on management (this pod's own cluster), in the environment's
// namespace, and the AtlasMigration on the cluster the environment runs on,
// by the platform label contract. Read-only, status only. Each read degrades
// to null on its own, logged, so a missing CRD or permission can't fail the
// caller.
export class SchemaReader {
  private readonly management: KubeConfig;

  constructor(
    private readonly namespaces: string[],
    private readonly clusters: ClusterKubeConfigs,
    private readonly logger: LoggerService,
  ) {
    this.management = new KubeConfig();
    this.management.loadFromDefault();
  }

  async read(component: string, environment: string): Promise<SchemaObjects> {
    const [databaseSchema, atlasMigration] = await Promise.all([
      this.findDatabaseSchema(component, environment),
      this.findAtlasMigration(component, environment),
    ]);
    return { databaseSchema, atlasMigration };
  }

  private warn(what: string, err: unknown) {
    this.logger.warn(`schema-reader: failed to read ${what} (${err instanceof Error ? err.message : String(err)})`);
  }

  private async findDatabaseSchema(component: string, environment: string): Promise<DatabaseSchemaResource | null> {
    // DatabaseSchemas live in the environment's namespace on management,
    // like Releases; only namespaces Backstage is configured to read.
    if (!this.namespaces.includes(environment)) {
      return null;
    }
    try {
      const res = await this.management.makeApiClient(CustomObjectsApi).listNamespacedCustomObject({
        group: 'platform.taskapp.io',
        version: 'v1alpha1',
        namespace: environment,
        plural: 'databaseschemas',
      });
      const items = (res as { items?: DatabaseSchemaResource[] }).items ?? [];
      return items.find(ds => ds.spec?.componentRef?.name === component) ?? null;
    } catch (err) {
      this.warn(`databaseschemas in ${environment}`, err);
      return null;
    }
  }

  private async findAtlasMigration(component: string, environment: string): Promise<K8sAtlasMigration | null> {
    try {
      const cluster = await this.clusters.forEnvironment(environment);
      if (!cluster) {
        return null;
      }
      const res = await cluster.kubeConfig.makeApiClient(CustomObjectsApi).listClusterCustomObject({
        group: 'db.atlasgo.io',
        version: 'v1alpha1',
        plural: 'atlasmigrations',
        labelSelector: `platform.taskapp.io/component=${component},platform.taskapp.io/environment=${environment}`,
      });
      return ((res as { items?: K8sAtlasMigration[] }).items ?? [])[0] ?? null;
    } catch (err) {
      this.warn(`atlasmigrations for ${component} in ${environment}`, err);
      return null;
    }
  }
}
