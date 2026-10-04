import {
  AppsV1Api,
  CoreV1Api,
  CustomObjectsApi,
  DiscoveryV1Api,
} from '@kubernetes/client-node';
import type { LoggerService } from '@backstage/backend-plugin-api';
import type { ReleaseVersionReader } from '../releaseVersions/ReleaseVersionReader';
import { isAutoDeploy, type ReleaseCustomResource } from '../releaseVersions/ReleaseVersionMapper';
import type { ClusterKubeConfigs } from '../platformClusters/ClusterKubeConfigs';
import type {
  EnvironmentObjects,
  K8sDeployment,
  K8sEndpointSlice,
  K8sEvent,
  K8sExternalSecret,
  K8sPod,
  K8sReplicaSet,
  K8sService,
  ReleaseForSummary,
} from './EnvironmentSummary';

// Reads everything one component's environment consists of, cluster-wide,
// by the platform label contract (BACKSTAGE_PART8.md) — never by namespace
// or naming convention. The Release is read here, on management; the
// workload objects on the cluster the environment runs on (ClusterKubeConfigs:
// this pod's own ServiceAccount locally, see chart/templates/clusterrole.yaml,
// or an EKS token on a workload cluster, see helm-charts platform
// backstage-reader.yaml). Read-only; never lists or gets Secrets.
//
// Each read degrades independently: a failed list is logged and contributes
// nothing, so one missing permission or CRD can't blank the whole view. The
// exception is the workload itself (Deployments, ReplicaSets, Pods): if those
// can't be read, the cluster is reported unreachable, so "couldn't read" never
// looks like "0 pods" (DEPLOYMENT_CARD_IMPLEMENTATION_PART1.md).
export class EnvironmentSummaryReader {
  constructor(
    private readonly releases: ReleaseVersionReader,
    private readonly clusters: ClusterKubeConfigs,
    private readonly logger: LoggerService,
  ) {}

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

  // Like attempt(), but also reports whether the read succeeded.
  private async required<T>(what: string, fn: () => Promise<T[]>): Promise<{ ok: boolean; items: T[] }> {
    try {
      return { ok: true, items: await fn() };
    } catch (err) {
      this.logger.warn(
        `environment-summary: failed to read ${what} (${err instanceof Error ? err.message : String(err)})`,
      );
      return { ok: false, items: [] };
    }
  }

  async read(component: string, environment: string): Promise<EnvironmentObjects> {
    // The Release lives on management whatever happens to the workload cluster.
    const releasePromise = this.attempt('Release', null, async () => this.findRelease(component, environment));
    const cluster = await this.attempt(`cluster for ${environment}`, null, async () =>
      this.clusters.forEnvironment(environment),
    );
    if (!cluster) {
      return {
        cluster: { name: null, reachable: false },
        release: await releasePromise,
        deployments: [],
        replicaSets: [],
        pods: [],
        services: [],
        endpointSlices: {},
        externalSecrets: [],
        events: [],
      };
    }

    const { kubeConfig } = cluster;
    const core = kubeConfig.makeApiClient(CoreV1Api);
    const apps = kubeConfig.makeApiClient(AppsV1Api);
    const discovery = kubeConfig.makeApiClient(DiscoveryV1Api);
    const custom = kubeConfig.makeApiClient(CustomObjectsApi);

    const labelSelector = `platform.taskapp.io/component=${component},platform.taskapp.io/environment=${environment}`;

    const [release, deploymentsRead, replicaSetsRead, podsRead, services, externalSecrets] = await Promise.all([
      releasePromise,
      this.required('deployments', async () =>
        (await apps.listDeploymentForAllNamespaces({ labelSelector })).items as K8sDeployment[],
      ),
      this.required('replicasets', async () =>
        (await apps.listReplicaSetForAllNamespaces({ labelSelector })).items as K8sReplicaSet[],
      ),
      this.required('pods', async () =>
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

    const deployments = deploymentsRead.items;
    const replicaSets = replicaSetsRead.items;
    const pods = podsRead.items;

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

    // Events live in the namespaces this component's objects are in. All
    // types: warnings for the warnings list, normal ones for rollout steps.
    const namespaces = new Set<string>();
    [...deployments, ...pods, ...externalSecrets].forEach(o => {
      if (o.metadata?.namespace) namespaces.add(o.metadata.namespace);
    });
    const events = (
      await Promise.all(
        [...namespaces].map(namespace =>
          this.attempt(`events in ${namespace}`, [] as K8sEvent[], async () =>
            (await core.listNamespacedEvent({ namespace })).items as K8sEvent[],
          ),
        ),
      )
    ).flat();

    return {
      cluster: { name: cluster.name, reachable: deploymentsRead.ok && replicaSetsRead.ok && podsRead.ok },
      release,
      deployments,
      replicaSets,
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
      autoDeploy: isAutoDeploy(match),
      bindings: match.spec?.bindings ?? {},
      ready: match.status?.conditions?.find(c => c.type === 'Ready') ?? null,
    };
  }
}
