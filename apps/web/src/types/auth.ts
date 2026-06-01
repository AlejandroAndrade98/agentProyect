// apps/web/src/types/auth.ts

import type { UserRole } from './user';

export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  organizationId: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: LoginUser;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ForgotPasswordResponse = {
  message: string;
  devResetUrl?: string;
};

export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
};

export type ResetPasswordResponse = {
  message: string;
};
