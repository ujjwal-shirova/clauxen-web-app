"use client";

import { useCallback, useEffect, useState } from "react";
import * as authApi from "@/frontend/lib/api/auth";
import type { SessionUser } from "@/frontend/lib/api/auth";

export function useAuth() {
  // useState — React local state tuple [value, setter]
  const [user, setUser] = useState<SessionUser | null>(null);
  // useState — React local state tuple [value, setter]
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const session = await authApi.getSession();
      setUser(session);
      // catch — exception handle; UI/state fallback
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: next } = await authApi.login(email, password);
    setUser(next);
    return next;
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName?: string;
    }) => {
      const { user: next } = await authApi.register(input);
      setUser(next);
      return next;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refresh,
  };
}
