import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { catalogPermissions } from '@backstage/plugin-catalog-common/alpha';
import { scaffolderPermissions } from '@backstage/plugin-scaffolder-common/alpha';
import type { PolicyQueryUser } from '@backstage/plugin-permission-node';
import type { Permission } from '@backstage/plugin-permission-common';
import {
  GUEST_ALLOWED_PERMISSIONS,
  OWNER_ENTITY_REF,
  PortfolioPermissionPolicy,
} from './policy';

function userWithRef(userEntityRef: string): PolicyQueryUser {
  return {
    info: { userEntityRef, ownershipEntityRefs: [userEntityRef] },
    credentials: {
      $$type: '@backstage/BackstageCredentials',
      principal: { type: 'user', userEntityRef },
    },
  };
}

const owner = userWithRef(OWNER_ENTITY_REF);
const guest = userWithRef('user:development/guest');
const allPermissions: Permission[] = [
  ...catalogPermissions,
  ...scaffolderPermissions,
];

describe('PortfolioPermissionPolicy', () => {
  const policy = new PortfolioPermissionPolicy();

  it.each(allPermissions.map(p => [p.name, p]))(
    'allows the owner %s',
    async (_name, permission) => {
      const decision = await policy.handle({ permission }, owner);
      expect(decision.result).toBe(AuthorizeResult.ALLOW);
    },
  );

  it.each(allPermissions.map(p => [p.name, p]))(
    'guest gets %s only if allowlisted',
    async (name, permission) => {
      const decision = await policy.handle({ permission }, guest);
      expect(decision.result).toBe(
        GUEST_ALLOWED_PERMISSIONS.has(name)
          ? AuthorizeResult.ALLOW
          : AuthorizeResult.DENY,
      );
    },
  );

  it('denies the guest template execution and location registration', async () => {
    for (const name of ['scaffolder.task.create', 'catalog.location.create']) {
      const permission = allPermissions.find(p => p.name === name)!;
      const decision = await policy.handle({ permission }, guest);
      expect(decision.result).toBe(AuthorizeResult.DENY);
    }
  });

  it('treats a request with no user like a guest', async () => {
    const permission = allPermissions.find(
      p => p.name === 'catalog.entity.delete',
    )!;
    const decision = await policy.handle({ permission });
    expect(decision.result).toBe(AuthorizeResult.DENY);
  });
});
