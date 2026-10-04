// Pure parsing: the Release manifest committed in application-repositories
// (platform/environments/<env>/<component>-release.yaml) -> what the Create
// deployment form needs to start from. No I/O here — see
// CommittedReleaseReader.ts for the GitHub read.
import { parse } from 'yaml';

export interface CommittedRelease {
  // false: no Release file for this component/environment on main yet.
  exists: boolean;
  autoDeploy: boolean;
  // spec.version when pinned; null for an auto-deploy Release or none.
  version: string | null;
  // binding type -> referenced resource, only the enabled ones.
  bindings: Record<string, string>;
}

const NONE: CommittedRelease = { exists: false, autoDeploy: false, version: null, bindings: {} };

// Same shape as a Kubernetes name: what component and environment names
// already are, and all that may go into the file path below.
const NAME = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export function isValidName(name: string): boolean {
  return name.length <= 63 && NAME.test(name);
}

export function committedReleasePath(component: string, environment: string): string {
  return `platform/environments/${environment}/${component}-release.yaml`;
}

// A file that isn't a parseable Release is reported as absent rather than
// failing the form: it then starts from the template's defaults, and the PR
// it opens rewrites the file whole.
interface ReleaseManifest {
  kind?: unknown;
  spec?: {
    version?: unknown;
    autoDeploy?: { enabled?: unknown } | null;
    bindings?: Record<string, { enabled?: unknown; ref?: unknown } | null> | null;
  } | null;
}

export function parseCommittedRelease(text: string | null): CommittedRelease {
  if (text === null) {
    return NONE;
  }
  let doc: ReleaseManifest | null;
  try {
    doc = parse(text) as ReleaseManifest | null;
  } catch {
    return NONE;
  }
  const spec = doc?.spec;
  if (doc?.kind !== 'Release' || typeof spec !== 'object' || spec === null) {
    return NONE;
  }
  const bindings: Record<string, string> = {};
  for (const [type, binding] of Object.entries(spec.bindings ?? {})) {
    if (binding?.enabled === true && typeof binding.ref === 'string' && binding.ref) {
      bindings[type] = binding.ref;
    }
  }
  const autoDeploy = spec.autoDeploy?.enabled === true;
  return {
    exists: true,
    autoDeploy,
    version: !autoDeploy && typeof spec.version === 'string' && spec.version ? spec.version : null,
    bindings,
  };
}
