import { apiRequest } from '@/lib/api/core';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginCredentials,
  LoginResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '@/types/auth';
import type { CurrentUser } from '@/types/user';

export function login(credentials: LoginCredentials) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export function getMe(token: string) {
  return apiRequest<CurrentUser>('/users/me', {
    token,
  });
}

export function forgotPassword(request: ForgotPasswordRequest) {
  return apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: request,
  });
}

export function resetPassword(request: ResetPasswordRequest) {
  return apiRequest<ResetPasswordResponse>('/auth/reset-password', {
    method: 'POST',
    body: request,
  });
}
