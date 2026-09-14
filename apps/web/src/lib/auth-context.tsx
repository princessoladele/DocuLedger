"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearTokens, getAccessToken, setTokens } from "./api-client";
import { CurrentUser } from "./types";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { organizationName: string; name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<{ accessToken: string; refreshToken: string; user: CurrentUser }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }), skipAuth: true },
      );
      setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      router.push("/dashboard");
    },
    [router],
  );

  const register = useCallback(
    async (input: { organizationName: string; name: string; email: string; password: string }) => {
      const result = await apiFetch<{ accessToken: string; refreshToken: string; user: CurrentUser }>(
        "/auth/register",
        { method: "POST", body: JSON.stringify(input), skipAuth: true },
      );
      setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      router.push("/dashboard");
    },
    [router],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
