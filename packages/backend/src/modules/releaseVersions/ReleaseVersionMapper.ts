// Pure transformation layer: Kubernetes Release CR -> {environment, version, releaseName}.
// No I/O here — see ReleaseVersionReader.ts for the Kubernetes client and
// listing loop. Deliberately does not touch Argo CD or sync/health at all —
// see BACKSTAGE_PART5.md's "Architecture" section: this is one of two
// independent read paths, never joined.

export interface ReleaseCustomResource {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  spec?: {
    componentRef?: {
      name?: string;
    };
    environment?: string;
    version?: string;
    // Read by the environment summary (modules/environmentSummary/), not
    // by the version mapping below.
    bindings?: Record<string, { enabled?: boolean; ref?: string } | undefined>;
  };
  status?: {
    conditions?: {
      type?: string;
      status?: string;
      reason?: string;
      message?: string;
    }[];
  };
}

export interface ReleaseVersion {
  environment: string;
  version: string;
  releaseName: string;
}

export interface MapperError {
  error: string;
}

export function mapReleaseToVersion(
  release: ReleaseCustomResource,
): ReleaseVersion | MapperError {
  const crName = release.metadata?.name;
  const crNamespace = release.metadata?.namespace;
  if (!crName || !crNamespace) {
    return {
      error: `Release is missing metadata.name or metadata.namespace (name=${crName}, namespace=${crNamespace})`,
    };
  }

  const componentName = release.spec?.componentRef?.name;
  if (!componentName) {
    return {
      error: `Release ${crNamespace}/${crName} has no spec.componentRef.name — skipping`,
    };
  }

  const environment = release.spec?.environment;
  if (!environment) {
    return {
      error: `Release ${crNamespace}/${crName} has no spec.environment — skipping`,
    };
  }

  // version is display-only and intentionally shown as-is — see
  // BACKSTAGE_PART5.md Step 2: "latest" is never resolved to a concrete
  // SHA/tag/digest here.
  const version = release.spec?.version ?? '';

  return { environment, version, releaseName: crName };
}

// Filters a mixed-component list of Release CRs down to one component's
// versions, sorted by environment. A malformed individual Release (caught
// by mapReleaseToVersion above) is dropped, never allowed to fail the
// whole list — same "skip, don't crash" rule as PlatformEntityProvider's
// Database mapper.
export function releaseVersionsForComponent(
  releases: ReleaseCustomResource[],
  component: string,
  onError?: (message: string) => void,
): ReleaseVersion[] {
  const versions: ReleaseVersion[] = [];

  for (const release of releases) {
    if (release.spec?.componentRef?.name !== component) {
      continue;
    }
    const mapped = mapReleaseToVersion(release);
    if ('error' in mapped) {
      onError?.(mapped.error);
      continue;
    }
    versions.push(mapped);
  }

  return versions.sort((a, b) => a.environment.localeCompare(b.environment));
}
