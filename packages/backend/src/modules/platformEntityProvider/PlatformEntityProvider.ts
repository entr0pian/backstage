import { KubeConfig, CustomObjectsApi } from '@kubernetes/client-node';
import type {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import type {
  LoggerService,
  SchedulerServiceTaskRunner,
} from '@backstage/backend-plugin-api';
import {
  mapDatabaseToEntity,
  type DatabaseCustomResource,
} from './DatabaseEntityMapper';

const GROUP = 'database.taskapp.io';
const VERSION = 'v1alpha1';
const PLURAL = 'databases';

export interface PlatformEntityProviderOptions {
  namespaces: string[];
  logger: LoggerService;
  schedule: SchedulerServiceTaskRunner;
}

// Discovers Database CRs (database.taskapp.io/v1alpha1) across the
// configured namespaces and publishes them as Backstage Resource entities.
// Read-only by construction: only ever calls the Kubernetes API's list
// verb, never create/update/patch/delete. See BACKSTAGE_PART4.md for the
// full design (this is intentionally scoped to Database only — adding
// another platform resource type is a new mapper + a second listing loop
// here, not a rewrite).
export class PlatformEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private readonly namespaces: string[];
  private readonly logger: LoggerService;
  private readonly schedule: SchedulerServiceTaskRunner;
  private readonly kubeConfig: KubeConfig;

  constructor(options: PlatformEntityProviderOptions) {
    this.namespaces = options.namespaces;
    this.logger = options.logger;
    this.schedule = options.schedule;

    // loadFromDefault() auto-detects: in-cluster ServiceAccount token when
    // running as a pod, otherwise the local ~/.kube/config context — no
    // branching needed between local dev and the real deployment.
    this.kubeConfig = new KubeConfig();
    this.kubeConfig.loadFromDefault();
  }

  getProviderName(): string {
    return 'platform-entity-provider:database';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.schedule.run({
      id: this.getProviderName(),
      fn: async () => {
        await this.refresh();
      },
    });
  }

  async refresh(): Promise<void> {
    if (!this.connection) {
      throw new Error(
        `${this.getProviderName()} refresh() called before connect()`,
      );
    }

    if (this.namespaces.length === 0) {
      this.logger.warn(
        `${this.getProviderName()}: no namespaces configured (platformCatalog.namespaces) — nothing to discover`,
      );
      return;
    }

    const api = this.kubeConfig.makeApiClient(CustomObjectsApi);
    const collected: Array<{ entity: Record<string, unknown> }> = [];

    // A namespace's list call failing (API server hiccup, RBAC drift, ...)
    // must not translate into "this Database no longer exists" — a partial
    // full-mutation would do exactly that for the failed namespace's
    // entities. So this cycle is entirely skipped (previous state kept)
    // unless every configured namespace was listed successfully.
    for (const namespace of this.namespaces) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await api.listNamespacedCustomObject({
          group: GROUP,
          version: VERSION,
          namespace,
          plural: PLURAL,
        });
        const items = (res as { items?: DatabaseCustomResource[] }).items ?? [];

        for (const item of items) {
          const mapped = mapDatabaseToEntity(item);
          if ('error' in mapped) {
            this.logger.warn(`${this.getProviderName()}: ${mapped.error}`);
            continue;
          }
          collected.push({ entity: mapped.entity });
        }
      } catch (err) {
        this.logger.warn(
          `${this.getProviderName()}: failed to list ${PLURAL}.${GROUP} in namespace "${namespace}" — skipping this refresh cycle entirely to avoid wrongly evicting entities from other namespaces (${err instanceof Error ? err.message : String(err)})`,
        );
        return;
      }
    }

    await this.connection.applyMutation({
      type: 'full',
      entities: collected.map(({ entity }) => ({
        entity: entity as never,
        locationKey: this.getProviderName(),
      })),
    });

    this.logger.info(
      `${this.getProviderName()}: published ${collected.length} Database entit${collected.length === 1 ? 'y' : 'ies'} across ${this.namespaces.length} namespace(s)`,
    );
  }
}
