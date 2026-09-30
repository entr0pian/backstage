import { KubeConfig } from '@kubernetes/client-node';
import type { Config } from '@backstage/config';
import { AwsIamStrategy } from '@backstage/plugin-kubernetes-backend';
import { RemoteClusters, toClusterDetails } from './RemoteClusters';

// A KubeConfig for the cluster an environment runs on: a registered remote
// cluster (RemoteClusters) with a fresh EKS token, or else the cluster
// Backstage itself runs on (its own ServiceAccount).
export class ClusterKubeConfigs {
  private readonly local: KubeConfig;

  constructor(
    private readonly remote: RemoteClusters,
    private readonly aws: AwsIamStrategy,
  ) {
    this.local = new KubeConfig();
    this.local.loadFromDefault();
  }

  static fromConfig(config: Config): ClusterKubeConfigs {
    return new ClusterKubeConfigs(
      RemoteClusters.fromConfig(config),
      new AwsIamStrategy({ config }),
    );
  }

  async forEnvironment(environment: string): Promise<KubeConfig> {
    const cluster = this.remote.get(environment);
    if (!cluster) {
      return this.local;
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
    return kubeConfig;
  }
}
