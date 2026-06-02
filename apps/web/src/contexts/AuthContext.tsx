'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getMe, login as apiLogin } from '@/lib/api-client';
import {
  clearStoredAuthSession,
  getStoredAccessToken,
  setStoredAuthSession,
  subscribeToAuthSession,
} from '@/lib/auth-session';
import type { LoginCredentials } from '@/types/auth';
import type { CurrentUser } from '@/types/user';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearStoredAuthSession();
    setToken(null);
    setUser(null);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const storedToken = getStoredAccessToken();

    if (!storedToken) {
      logout();
      return;
    }

    const currentUser = await getMe(storedToken);
    const latestStoredToken = getStoredAccessToken() ?? storedToken;

    setToken(latestStoredToken);
    setUser(currentUser);
  }, [logout]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await apiLogin(credentials);

    setStoredAuthSession(response);

    const currentUser = await getMe(response.accessToken);
    const latestStoredToken = getStoredAccessToken() ?? response.accessToken;

    setToken(latestStoredToken);
    setUser(currentUser);
  }, []);

  useEffect(
    () =>
      subscribeToAuthSession((session) => {
        setToken(session?.accessToken ?? null);

        if (!session) {
          setUser(null);
        }
      }),
    [],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadStoredSession() {
      try {
        const storedToken = getStoredAccessToken();

        if (!storedToken) {
          return;
        }

        const currentUser = await getMe(storedToken);
        const latestStoredToken = getStoredAccessToken() ?? storedToken;

        if (!isMounted) {
          return;
        }

        setToken(latestStoredToken);
        setUser(currentUser);
      } catch {
        clearStoredAuthSession();

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
