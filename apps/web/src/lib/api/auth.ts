import { apiRequest } from '@/lib/api/core';
import type { LoginCredentials, LoginResponse } from '@/types/auth';
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