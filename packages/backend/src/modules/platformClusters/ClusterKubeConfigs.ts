import { KubeConfig } from '@kubernetes/client-node';
import type { Config } from '@backstage/config';
import { AwsIamStrategy } from '@backstage/plugin-kubernetes-backend';
import { RemoteClusters, toClusterDetails } from './RemoteClusters';

export interface EnvironmentCluster {
  // The cluster's name as the platform knows it (the environment's name).
  name: string;
  kubeConfig: KubeConfig;
}

// A KubeConfig for the cluster an environment runs on: the cluster Backstage
// itself runs on (its own ServiceAccount) for `platform.localEnvironment`, or
// a registered remote cluster (RemoteClusters) with a fresh EKS token. Any
// other environment resolves to null — never silently to the local cluster,
// whose answer ("0 pods") would read as real state for a cluster that is down
// or unknown (DEPLOYMENT_CARD_FINDINGS.md §2).
export class ClusterKubeConfigs {
  private readonly local: KubeConfig;

  constructor(
    private readonly remote: RemoteClusters,
    private readonly aws: AwsIamStrategy,
    private readonly localEnvironment: string | undefined,
  ) {
    this.local = new KubeConfig();
    this.local.loadFromDefault();
  }

  static fromConfig(config: Config): ClusterKubeConfigs {
    return new ClusterKubeConfigs(
      RemoteClusters.fromConfig(config),
      new AwsIamStrategy({ config }),
      config.getOptionalString('platform.localEnvironment'),
    );
  }

  async forEnvironment(environment: string): Promise<EnvironmentCluster | null> {
    if (environment === this.localEnvironment) {
      return { name: environment, kubeConfig: this.local };
    }
    const cluster = this.remote.get(environment);
    if (!cluster) {
      return null;
    }
    // Signing is local (a presigned STS URL, valid 15 minutes), so a token
    // per request costs nothing and never goes stale.
    const credential = await this.aws.getCredential(toClusterDetails(cluster));
    if (credential.type !== 'bearer token') {
      throw new Error(`no EKS token for ${cluster.clusterName}`);
    }
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromOptions({
      clusters: [{ name: environment, server: cluster.server, caData: cluster.caData, skipTLSVerify: false }],
      users: [{ name: 'backstage', token: credential.token }],
      contexts: [{ name: environment, cluster: environment, user: 'backstage' }],
      currentContext: environment,
    });
    return { name: cluster.clusterName, kubeConfig };
  }
}
