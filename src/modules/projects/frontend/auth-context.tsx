"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getStoredToken,
  setStoredToken,
  login as apiLogin,
  register as apiRegister,
  type AuthUser,
} from "@/projects/frontend/api";

type ProjectsAuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const ProjectsAuthContext = createContext<ProjectsAuthContextValue | null>(
  null,
);

export function ProjectsAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as {
        sub?: string;
        email?: string;
      };
      if (payload.sub && payload.email) {
        setUser({ id: payload.sub, email: payload.email });
      }
    } catch {
      setStoredToken(null);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u, token } = await apiLogin(email, password);
    setStoredToken(token);
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const { user: u, token } = await apiRegister(email, password);
    setStoredToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return (
    <ProjectsAuthContext.Provider value={value}>
      {children}
    </ProjectsAuthContext.Provider>
  );
}

export function useProjectsAuth() {
  const ctx = useContext(ProjectsAuthContext);
  if (!ctx) {
    throw new Error("useProjectsAuth must be used within ProjectsAuthProvider");
  }
  return ctx;
}
