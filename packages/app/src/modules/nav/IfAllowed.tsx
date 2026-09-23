import type { ReactNode } from 'react';
import type { BasicPermission } from '@backstage/plugin-permission-common';
import { usePermission } from '@backstage/plugin-permission-react';

// Renders children only once the permission is confirmed allowed — nothing
// while loading or when denied, so visitors never see a flash of an
// owner-only entry. Cosmetic only; the backend permission policy is what
// actually enforces access.
export const IfAllowed = (props: {
  permission: BasicPermission;
  children: ReactNode;
}) => {
  const { allowed } = usePermission({ permission: props.permission });
  return allowed ? <>{props.children}</> : null;
};
