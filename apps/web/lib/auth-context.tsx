"use client";

import type { UserDto } from "@tres-cielos/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, readJson } from "./http";

type AuthState = {
  user: UserDto | null;
  loading: boolean;
  refreshMe: () => Promise<UserDto | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const res = await apiFetch("/auth/me", { method: "GET" }, { retryOn401: true });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const json = await readJson<{ user: UserDto }>(res);
      setUser(json.user);
      return json.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" }, { retryOn401: false });
    } catch {
      /* el API puede estar caído; igual cerramos sesión en el cliente */
    }
    setUser(null);
    window.location.assign("/login");
  }, []);

  useEffect(() => {
    void refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const value = useMemo(
    () => ({ user, loading, refreshMe, logout }),
    [user, loading, refreshMe, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
