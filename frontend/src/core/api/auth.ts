import { request } from './client';

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  aiCallsRemaining?: number;
}

export interface AuthResponse {
  user: ApiUser;
  token?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (email: string, password: string, name: string) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: { email, password, name } }),
  loginWithGoogle: (token: string) =>
    request<AuthResponse>('/api/auth/google', { method: 'POST', body: { token } }),
  loginWithFacebook: (token: string) =>
    request<AuthResponse>('/api/auth/facebook', { method: 'POST', body: { token } }),
  loginWithTwitter: (token: string) =>
    request<AuthResponse>('/api/auth/twitter', { method: 'POST', body: { token } }),
  exchangeCode: (code: string) =>
    request<AuthResponse>('/api/auth/exchange', { method: 'POST', body: { code } }),
  me: () => request<ApiUser>('/api/auth/me', { suppressUnauthorizedEvent: true }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST', suppressUnauthorizedEvent: true }),
};
