import type { BackstageUserPrincipal } from '@backstage/backend-plugin-api';
import {
  AuthorizeResult,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';

// The one identity allowed to do anything beyond browsing — resolved from a
// GitHub sign-in by usernameMatchingUserEntityName against the User entity
// in org-data/users.yaml.
export const OWNER_ENTITY_REF = 'user:default/entr0pian';

// Everything a visitor (guest sign-in) needs to browse the portal, and
// nothing else. An explicit allowlist rather than "any read action" on
// purpose: several read permissions expose more than a portfolio visitor
// should see — kubernetes.resources.read returns raw pod specs (env vars
// included), scaffolder.task.read returns past task logs. A permission a
// newly installed plugin adds is denied until it's listed here.
export const GUEST_ALLOWED_PERMISSIONS = new Set([
  'catalog.entity.read',
  'catalog.location.read',
  'argocd.view.read',
]);

// user.info is deprecated; the principal carries the same entity ref.
function userEntityRefOf(user?: PolicyQueryUser): string | undefined {
  const principal = user?.credentials.principal as
    | Partial<BackstageUserPrincipal>
    | undefined;
  return principal?.type === 'user' ? principal.userEntityRef : undefined;
}

// Only consulted for user principals — service-to-service calls between
// backend plugins are decided by ServerPermissionClient without reaching
// the policy.
export class PortfolioPermissionPolicy implements PermissionPolicy {
  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    if (userEntityRefOf(user) === OWNER_ENTITY_REF) {
      return { result: AuthorizeResult.ALLOW };
    }
    if (GUEST_ALLOWED_PERMISSIONS.has(request.permission.name)) {
      return { result: AuthorizeResult.ALLOW };
    }
    return { result: AuthorizeResult.DENY };
  }
}
