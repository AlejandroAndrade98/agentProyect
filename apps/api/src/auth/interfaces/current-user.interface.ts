import type { Role } from '@prisma/client';

export interface CurrentUser {
  id: string;
  organizationId: string;
  role: Role;
}

export interface JwtAccessPayload {
  sub: string;
  organizationId: string;
  role: Role;
  iat?: number;
  exp?: number;
}