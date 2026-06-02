import { getStoredAppLocale } from '@/i18n/stored-locale';
import {
  clearStoredAuthSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredAuthSession,
  type StoredAuthSession,
} from '@/lib/auth-session';
import type { LoginResponse } from '@/types/auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
  'http://localhost:4000/api';

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  skipAuthRefresh?: boolean;
};

export class ApiClientError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

function buildUrl(path: string, query?: ApiRequestOptions['query']) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function getRequestToken(options: ApiRequestOptions) {
  if (!options.token) {
    return undefined;
  }

  return getStoredAccessToken() ?? options.token;
}

async function parseResponsePayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function createApiClientError(response: Response) {
  const details = await parseResponsePayload(response);
  const message =
    typeof details === 'object' && details !== null && 'message' in details
      ? String(details.message)
      : `Request failed with status ${response.status}`;

  return new ApiClientError(message, response.status, details);
}

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

function expireStoredSession() {
  clearStoredAuthSession();
  redirectToLogin();
}

let refreshSessionPromise: Promise<StoredAuthSession> | null = null;

async function requestAuthRefresh() {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    throw new ApiClientError('Session refresh token is missing.', 401, null);
  }

  const headers = new Headers();

  headers.set('Content-Type', 'application/json');
  headers.set('X-App-Locale', getStoredAppLocale());

  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw await createApiClientError(response);
  }

  const payload = (await parseResponsePayload(response)) as LoginResponse | null;

  if (!payload?.accessToken || !payload.refreshToken) {
    throw new ApiClientError('Invalid refresh response.', response.status, payload);
  }

  const session = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
  };

  setStoredAuthSession(session);
  return session;
}

async function refreshStoredAuthSession() {
  if (!refreshSessionPromise) {
    refreshSessionPromise = requestAuthRefresh().finally(() => {
      refreshSessionPromise = null;
    });
  }

  return refreshSessionPromise;
}

type InternalApiRequestOptions = ApiRequestOptions & {
  hasRetriedUnauthorized?: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return performApiRequest<T>(path, options);
}

async function performApiRequest<T>(
  path: string,
  options: InternalApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers();
  const requestToken = getRequestToken(options);

  headers.set('Content-Type', 'application/json');
  headers.set('X-App-Locale', getStoredAppLocale());

  if (requestToken) {
    headers.set('Authorization', `Bearer ${requestToken}`);
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const canRefreshUnauthorizedRequest =
    response.status === 401 &&
    Boolean(requestToken) &&
    !options.skipAuthRefresh &&
    !options.hasRetriedUnauthorized &&
    normalizePath(path) !== '/auth/refresh';

  if (canRefreshUnauthorizedRequest) {
    try {
      const refreshedSession = await refreshStoredAuthSession();

      return performApiRequest<T>(path, {
        ...options,
        token: refreshedSession.accessToken,
        hasRetriedUnauthorized: true,
        skipAuthRefresh: true,
      });
    } catch (error) {
      expireStoredSession();
      throw error;
    }
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      Boolean(requestToken) &&
      (options.skipAuthRefresh || options.hasRetriedUnauthorized)
    ) {
      expireStoredSession();
    }

    throw await createApiClientError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await parseResponsePayload(response)) as T;
}
