import { KubeConfig, CustomObjectsApi } from '@kubernetes/client-node';
import type { LoggerService } from '@backstage/backend-plugin-api';
import {
  releaseVersionsForComponent,
  type ReleaseCustomResource,
  type ReleaseVersion,
} from './ReleaseVersionMapper';

const GROUP = 'platform.taskapp.io';
const VERSION = 'v1alpha1';
const PLURAL = 'releases';

export interface ReleaseVersionReaderOptions {
  namespaces: string[];
  logger: LoggerService;
}

// Lists Release CRs (platform.taskapp.io/v1alpha1) across the configured
// namespaces and returns one component's versions — read-only, same
// KubeConfig.loadFromDefault()/CustomObjectsApi pattern as
// PlatformEntityProvider (see modules/platformEntityProvider/), but a
// plain per-request read rather than a polled EntityProvider: this data is
// served on demand from the Deployments-tab HTTP route, not published into
// the catalog itself.
export class ReleaseVersionReader {
  private readonly namespaces: string[];
  private readonly logger: LoggerService;
  private readonly kubeConfig: KubeConfig;

  constructor(options: ReleaseVersionReaderOptions) {
    this.namespaces = options.namespaces;
    this.logger = options.logger;
    this.kubeConfig = new KubeConfig();
    this.kubeConfig.loadFromDefault();
  }

  async listForComponent(component: string): Promise<ReleaseVersion[]> {
    const api = this.kubeConfig.makeApiClient(CustomObjectsApi);
    const all: ReleaseCustomResource[] = [];

    for (const namespace of this.namespaces) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await api.listNamespacedCustomObject({
          group: GROUP,
          version: VERSION,
          namespace,
          plural: PLURAL,
        });
        const items = (res as { items?: ReleaseCustomResource[] }).items ?? [];
        all.push(...items);
      } catch (err) {
        // Unlike PlatformEntityProvider's polled full-mutation (where a
        // partial failure would wrongly evict entities), this is a plain
        // per-request read — a namespace that fails to list just
        // contributes no releases for this request, logged, not fatal to
        // the other namespaces or the request as a whole.
        this.logger.warn(
          `release-version-reader: failed to list ${PLURAL}.${GROUP} in namespace "${namespace}" (${err instanceof Error ? err.message : String(err)})`,
        );
      }
    }

    return releaseVersionsForComponent(all, component, message =>
      this.logger.warn(`release-version-reader: ${message}`),
    );
  }
}
