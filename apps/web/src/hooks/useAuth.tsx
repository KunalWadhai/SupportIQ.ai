"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authApi } from "@/lib/api";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthOrg {
  id: string;
  name: string;
  apiKey: string;
  widgetColor: string;
  widgetGreeting: string;
  plan: string;
}

interface AuthState {
  user: AuthUser | null;
  org: AuthOrg | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    orgName: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_COOKIE = "supportiq_token";
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, matches JWT expiry

function setTokenCookie(token: string) {
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${TOKEN_MAX_AGE}; SameSite=Lax`;
}

function clearTokenCookie() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    org: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const setAuth = (token: string, user: AuthUser, org: AuthOrg) => {
    localStorage.setItem(TOKEN_COOKIE, token);
    setTokenCookie(token);
    setState({ user, org, token, isLoading: false, isAuthenticated: true });
  };

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_COOKIE);
    clearTokenCookie();
    setState({ user: null, org: null, token: null, isLoading: false, isAuthenticated: false });
  };

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me();
      setState((prev) => ({
        ...prev,
        user: data.user,
        org: data.org,
        isAuthenticated: true,
        isLoading: false,
      }));
    } catch {
      clearAuth();
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_COOKIE);
    if (token) {
      refreshUser();
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setAuth(data.token, data.user, data.org);
  };

  const register = async (body: {
    name: string;
    email: string;
    password: string;
    orgName: string;
  }) => {
    const data = await authApi.register(body);
    setAuth(data.token, data.user, data.org);
  };

  const logout = () => clearAuth();

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
