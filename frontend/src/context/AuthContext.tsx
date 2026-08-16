import React, { createContext, useCallback, useEffect, useState } from 'react';
import { User } from '@/types/user';
import { authApi, setToken } from '@/features/auth/api';
import { queryClient } from '@/lib/queryClient';
import { clearOfflineQueue } from '@/lib/syncQueue';

type AuthProviderName = 'google' | 'facebook' | 'twitter';

interface AuthContextType {
  user: User | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithProvider: (provider: AuthProviderName, token: string) => Promise<void>;
  loadUser: () => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function apiUserToUser(a: { id: string; email: string; name: string; role: 'admin' | 'user'; createdAt?: string; subscriptionStatus?: string; subscriptionPlan?: string | null; subscriptionCurrentPeriodEnd?: string | null; aiCallsRemaining?: number }): User {
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    createdAt: a.createdAt,
    subscriptionStatus: (a.subscriptionStatus as User['subscriptionStatus']) || 'free',
    subscriptionPlan: a.subscriptionPlan === 'monthly' || a.subscriptionPlan === 'yearly' ? a.subscriptionPlan : null,
    subscriptionCurrentPeriodEnd: a.subscriptionCurrentPeriodEnd ?? undefined,
    aiCallsRemaining: a.aiCallsRemaining,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(apiUserToUser(me));
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token ?? null);
    setUser(apiUserToUser(res.user));
  }, []);

  const clearClientSession = useCallback(async () => {
    setToken(null);
    setUser(null);
    queryClient.clear();
    await clearOfflineQueue().catch(() => {});
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name === 'api-cache').map((name) => caches.delete(name)));
    }
  }, []);

  const logout = useCallback(async () => {
    // Call backend to invalidate refresh token (best effort)
    try {
      await authApi.logout();
    } catch {
      // Ignore errors - we still want to clear local state
    }
    await clearClientSession();
  }, [clearClientSession]);

  useEffect(() => {
    const onLogout = () => {
      logout().catch(() => {});
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [logout]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await authApi.register(email, password, name);
    setToken(res.token ?? null);
    setUser(apiUserToUser(res.user));
  }, []);

  const loginWithProvider = useCallback(async (provider: AuthProviderName, token: string) => {
    const res =
      provider === 'google'
        ? await authApi.loginWithGoogle(token)
        : provider === 'facebook'
          ? await authApi.loginWithFacebook(token)
          : await authApi.loginWithTwitter(token);
    setToken(res.token ?? null);
    setUser(apiUserToUser(res.user));
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading, login, loginWithProvider, loadUser, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
