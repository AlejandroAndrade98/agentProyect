'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getMe, login as apiLogin } from '@/lib/api-client';
import type { LoginCredentials } from '@/types/auth';
import type { CurrentUser } from '@/types/user';

const ACCESS_TOKEN_STORAGE_KEY = 'sales_ai_access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'sales_ai_refresh_token';

type AuthContextValue = {
  user: CurrentUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshCurrentUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

function clearStoredAuth() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

    if (!storedToken) {
      logout();
      return;
    }

    const currentUser = await getMe(storedToken);

    setToken(storedToken);
    setUser(currentUser);
  }, [logout]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await apiLogin(credentials);

    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, response.refreshToken);

    const currentUser = await getMe(response.accessToken);

    setToken(response.accessToken);
    setUser(currentUser);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadStoredSession() {
      try {
        const storedToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

        if (!storedToken) {
          return;
        }

        const currentUser = await getMe(storedToken);

        if (!isMounted) {
          return;
        }

        setToken(storedToken);
        setUser(currentUser);
      } catch {
        clearStoredAuth();

        if (!isMounted) {
          return;
        }

        setToken(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStoredSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      refreshCurrentUser,
    }),
    [user, token, isLoading, login, logout, refreshCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}