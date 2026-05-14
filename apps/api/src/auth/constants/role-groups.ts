import { Role } from '@prisma/client';

export const CRM_READ_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.OWNER,
  Role.ADMIN,
  Role.SALES,
  Role.VIEWER,
];

export const CRM_WRITE_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.OWNER,
  Role.ADMIN,
  Role.SALES,
];

export const CRM_DELETE_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.OWNER,
  Role.ADMIN,
];

export const PRODUCT_MANAGE_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.OWNER,
  Role.ADMIN,
];