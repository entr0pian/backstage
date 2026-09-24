import {
  AppsV1Api,
  CoreV1Api,
  CustomObjectsApi,
  DiscoveryV1Api,
  KubeConfig,
} from '@kubernetes/client-node';
import type { LoggerService } from '@backstage/backend-plugin-api';
import type { ReleaseVersionReader } from '../releaseVersions/ReleaseVersionReader';
import type { ReleaseCustomResource } from '../releaseVersions/ReleaseVersionMapper';
import type {
  EnvironmentObjects,
  K8sDeployment,
  K8sEndpointSlice,
  K8sEvent,
  K8sExternalSecret,
  K8sPod,
  K8sService,
  ReleaseForSummary,
} from './EnvironmentSummary';

// Reads everything one component's environment consists of, cluster-wide,
// by the platform label contract (BACKSTAGE_PART8.md) — never by namespace
// or naming convention. Read-only; uses this pod's own ServiceAccount (see
// chart/templates/clusterrole.yaml for exactly what it may read). Never
// lists or gets Secrets.
//
// Each read degrades independently: a failed list is logged and contributes
// nothing, so one missing permission or CRD can't blank the whole view.
export class EnvironmentSummaryReader {
  private readonly kubeConfig: KubeConfig;

  constructor(
    private readonly releases: ReleaseVersionReader,
    private readonly logger: LoggerService,
  ) {
    this.kubeConfig = new KubeConfig();
    this.kubeConfig.loadFromDefault();
  }

  private async attempt<T>(what: string, fallback: T, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger.warn(
        `environment-summary: failed to read ${what} (${err instanceof Error ? err.message : String(err)})`,
      );
      return fallback;
    }
  }

  async read(component: string, environment: string): Promise<EnvironmentObjects> {
    const core = this.kubeConfig.makeApiClient(CoreV1Api);
    const apps = this.kubeConfig.makeApiClient(AppsV1Api);
    const discovery = this.kubeConfig.makeApiClient(DiscoveryV1Api);
    const custom = this.kubeConfig.makeApiClient(CustomObjectsApi);

    const labelSelector = `platform.taskapp.io/component=${component},platform.taskapp.io/environment=${environment}`;

    const [release, deployments, replicaSets, pods, services, externalSecrets] = await Promise.all([
      this.attempt('Release', null, async () => this.findRelease(component, environment)),
      this.attempt('deployments', [] as K8sDeployment[], async () =>
        (await apps.listDeploymentForAllNamespaces({ labelSelector })).items as K8sDeployment[],
      ),
      this.attempt('replicasets', [] as { namespace: string; name: string }[], async () =>
        (await apps.listReplicaSetForAllNamespaces({ labelSelector })).items
          .filter(rs => rs.metadata?.name && rs.metadata.namespace)
          .map(rs => ({ namespace: rs.metadata!.namespace!, name: rs.metadata!.name! })),
      ),
      this.attempt('pods', [] as K8sPod[], async () =>
        (await core.listPodForAllNamespaces({ labelSelector })).items as K8sPod[],
      ),
      this.attempt('services', [] as K8sService[], async () =>
        (await core.listServiceForAllNamespaces({ labelSelector })).items as K8sService[],
      ),
      this.attempt('externalsecrets', [] as K8sExternalSecret[], async () => {
        const res = await custom.listClusterCustomObject({
          group: 'external-secrets.io',
          version: 'v1beta1',
          plural: 'externalsecrets',
          labelSelector,
        });
        return ((res as { items?: K8sExternalSecret[] }).items ?? []);
      }),
    ]);

    const endpointSlices: Record<string, K8sEndpointSlice[]> = {};
    await Promise.all(
      services
        .filter(s => s.metadata?.name && s.metadata.namespace)
        .map(async s => {
          const key = `${s.metadata!.namespace}/${s.metadata!.name}`;
          endpointSlices[key] = await this.attempt(`endpointslices for ${key}`, [] as K8sEndpointSlice[], async () =>
            (
              await discovery.listNamespacedEndpointSlice({
                namespace: s.metadata!.namespace!,
                labelSelector: `kubernetes.io/service-name=${s.metadata!.name}`,
              })
            ).items as K8sEndpointSlice[],
          );
        }),
    );

    // Warning events live in the namespaces this component's objects are in.
    const namespaces = new Set<string>();
    [...deployments, ...pods, ...externalSecrets].forEach(o => {
      if (o.metadata?.namespace) namespaces.add(o.metadata.namespace);
    });
    const events = (
      await Promise.all(
        [...namespaces].map(namespace =>
          this.attempt(`events in ${namespace}`, [] as K8sEvent[], async () =>
            (await core.listNamespacedEvent({ namespace, fieldSelector: 'type=Warning' })).items as K8sEvent[],
          ),
        ),
      )
    ).flat();

    return {
      release,
      deployments,
      replicaSetNames: replicaSets,
      pods,
      services,
      endpointSlices,
      externalSecrets,
      events,
    };
  }

  private async findRelease(component: string, environment: string): Promise<ReleaseForSummary | null> {
    const match = (await this.releases.listAll()).find(
      (r: ReleaseCustomResource) =>
        r.spec?.componentRef?.name === component && r.spec?.environment === environment,
    );
    if (!match?.metadata?.name || !match.metadata.namespace) {
      return null;
    }
    return {
      name: match.metadata.name,
      namespace: match.metadata.namespace,
      version: match.spec?.version ?? '',
      bindings: match.spec?.bindings ?? {},
      ready: match.status?.conditions?.find(c => c.type === 'Ready') ?? null,
    };
  }
}
