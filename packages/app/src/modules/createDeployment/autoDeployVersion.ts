// Pure: the version an auto-deploy Release's PR writes. With auto-deploy on
// the form offers no choice, so it keeps the committed version (a full
// commit SHA), or none when there isn't one yet: release-operator then sets
// the newest green build.
const COMMIT_SHA = /^[0-9a-f]{40}$/;

export function autoDeployVersion(committed: string | null): string | undefined {
  return committed && COMMIT_SHA.test(committed) ? committed : undefined;
}
