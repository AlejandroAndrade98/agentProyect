import type { CurrentUser, UserRole } from '@/types/user';

const CRM_WRITE_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'OWNER',
  'ADMIN',
  'SALES',
];

const CRM_DELETE_ROLES: UserRole[] = ['SUPER_ADMIN', 'OWNER', 'ADMIN'];

const PRODUCT_MANAGE_ROLES: UserRole[] = ['SUPER_ADMIN', 'OWNER', 'ADMIN'];

function hasRole(user: CurrentUser | null, roles: UserRole[]) {
  if (!user) {
    return false;
  }

  return roles.includes(user.role);
}

export function canReadCrm(user: CurrentUser | null) {
  return Boolean(user);
}

export function canCreateCrm(user: CurrentUser | null) {
  return hasRole(user, CRM_WRITE_ROLES);
}

export function canUpdateCrm(user: CurrentUser | null) {
  return hasRole(user, CRM_WRITE_ROLES);
}

export function canDeleteCrm(user: CurrentUser | null) {
  return hasRole(user, CRM_DELETE_ROLES);
}

export function canManageProducts(user: CurrentUser | null) {
  return hasRole(user, PRODUCT_MANAGE_ROLES);
}