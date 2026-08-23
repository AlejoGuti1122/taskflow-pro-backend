import { SetMetadata } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Requires the caller's Membership.role for the resolved organization to be one of `roles`.
// Must be combined with @ResourceOrg(...) so OrganizationAccessGuard can resolve the membership.
export const Roles = (...roles: MembershipRole[]) =>
  SetMetadata(ROLES_KEY, roles);
