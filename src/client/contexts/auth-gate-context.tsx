"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AuthGateDialog } from "@/components/auth/auth-gate-dialog";
import { useAuth } from "@/hooks/use-auth";

type OpenAuthGateOptions = {
  /** Keep the deep-link destination so sign-in can resume the journey. */
  redirectTo?: string | null;
};

type AuthGateContextValue = {
  isOpen: boolean;
  openAuthGate: (options?: OpenAuthGateOptions) => void;
  closeAuthGate: () => void;
  /**
   * Returns true when a session exists. Otherwise opens the sign-in dialog
   * (the exact `/login` form as an in-app popup) and returns false — call
   * sites just `return` early.
   */
  requireAuth: (options?: OpenAuthGateOptions) => boolean;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

function readGateQuery(): {
  auth: boolean;
  redirectTo: string | null;
  error: string | null;
} {
  if (typeof window === "undefined") {
    return { auth: false, redirectTo: null, error: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    auth: params.get("auth") === "1",
    redirectTo: params.get("redirectTo"),
    error: params.get("error"),
  };
}

function stripGateQuery() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("auth") && !params.has("redirectTo") && !params.has("error")) {
    return;
  }
  params.delete("auth");
  params.delete("redirectTo");
  params.delete("error");
  const search = params.toString();
  const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

/**
 * Guest preview support: the app renders for everyone; anything that needs
 * a session funnels through this gate and opens the sign-in dialog.
 */
export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);

  const openAuthGate = useCallback((options?: OpenAuthGateOptions) => {
    if (options?.redirectTo !== undefined) setRedirectTo(options.redirectTo);
    setIsOpen(true);
  }, []);

  const closeAuthGate = useCallback(() => {
    setIsOpen(false);
    setRedirectTo(null);
    setInitialError(null);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("clx_auth_gate_dismissed", "1");
    }
  }, []);

  const requireAuth = useCallback(
    (options?: OpenAuthGateOptions) => {
      if (isAuthenticated) return true;
      openAuthGate(options);
      return false;
    },
    [isAuthenticated, openAuthGate],
  );

  useEffect(() => {
    // Signed in (incl. Google One Tap) → dismiss the gate and continue.
    if (isAuthenticated && isOpen) closeAuthGate();
  }, [isAuthenticated, isOpen, closeAuthGate]);

  // Deep-link bounce from middleware or first-visit open for new users
  useEffect(() => {
    const gateQuery = readGateQuery();
    if (gateQuery.auth) {
      setRedirectTo(gateQuery.redirectTo);
      setInitialError(gateQuery.error);
      setIsOpen(true);
      stripGateQuery();
      return;
    }
    if (!loading && !isAuthenticated) {
      const dismissed =
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("clx_auth_gate_dismissed") === "1";
      if (!dismissed) {
        setIsOpen(true);
      }
    }
  }, [loading, isAuthenticated]);

  const value = useMemo<AuthGateContextValue>(
    () => ({ isOpen, openAuthGate, closeAuthGate, requireAuth }),
    [isOpen, openAuthGate, closeAuthGate, requireAuth],
  );

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      <AuthGateDialog
        open={isOpen}
        onOpenChange={(open) => (open ? setIsOpen(true) : closeAuthGate())}
        redirectTo={redirectTo}
        initialError={initialError}
      />
    </AuthGateContext.Provider>
  );
}

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error("useAuthGate must be used within AuthGateProvider");
  }
  return ctx;
}

/** For components that also render outside the main shell (safe no-gate). */
export function useOptionalAuthGate(): AuthGateContextValue | null {
  return useContext(AuthGateContext);
}
