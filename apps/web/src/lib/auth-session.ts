export const ACCESS_TOKEN_STORAGE_KEY = 'sales_ai_access_token';
export const REFRESH_TOKEN_STORAGE_KEY = 'sales_ai_refresh_token';

export type StoredAuthSession = {
  accessToken: string;
  refreshToken: string;
};

type AuthSessionListener = (session: StoredAuthSession | null) => void;

const listeners = new Set<AuthSessionListener>();

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function notifyAuthSessionChange(session: StoredAuthSession | null) {
  listeners.forEach((listener) => listener(session));
}

export function getStoredAccessToken() {
  if (!canUseBrowserStorage()) {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function getStoredRefreshToken() {
  if (!canUseBrowserStorage()) {
    return null;
  }

  return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function setStoredAuthSession(session: StoredAuthSession) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken);
  notifyAuthSessionChange(session);
}

export function clearStoredAuthSession() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  notifyAuthSessionChange(null);
}

export function subscribeToAuthSession(listener: AuthSessionListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
