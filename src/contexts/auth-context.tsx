"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { logSupabaseQueryError } from "@/lib/supabase-query-error";
import * as authApi from "@/lib/api/auth";
import type { SessionUser } from "@/lib/api/auth";
import {
  mapSupabaseAuthError,
  type OAuthProvider,
} from "@/components/auth/auth-shared";
import {
  clearIdentityHintFromDocument,
  readIdentityHintFromDocument,
} from "@/utils/identity-cookie";
import { resolveAuthFullName } from "@/lib/profile-names";
import { oauthSignInOptions } from "@/lib/oauth-providers";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (input: {
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<SessionUser>;
  signInWithOAuth: (
    provider: OAuthProvider,
    redirectTo?: string,
  ) => Promise<void>;
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<void>;
  signInWithPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<SessionUser>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: (opts?: { quiet?: boolean }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function appOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:9002";
}

function sessionFromSupabaseUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): SessionUser {
  const meta = user.user_metadata ?? null;
  const preferred =
    typeof meta?.preferred_name === "string"
      ? meta.preferred_name.trim() || null
      : null;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: resolveAuthFullName(meta) ?? user.email?.split("@")[0] ?? null,
    preferredName: preferred,
    avatarUrl:
      typeof meta?.avatar_url === "string"
        ? meta.avatar_url
        : typeof meta?.picture === "string"
          ? meta.picture
          : null,
  };
}

function hintToSession(): SessionUser | null {
  const hint = readIdentityHintFromDocument();
  if (!hint?.id) return null;
  return {
    id: hint.id,
    email: hint.email,
    displayName: hint.displayName,
    preferredName: hint.preferredName,
    avatarUrl: hint.avatarUrl,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => hintToSession());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    try {
      const session = await authApi.getSession(
        opts?.quiet ? { quiet: true } : undefined,
      );
      if (session) {
        setUser(session);
        return;
      }
      // API said null — confirm with Supabase JWT before clearing.
      const supabase = createClient();
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser();
      if (sbUser?.id) {
        setUser(sessionFromSupabaseUser(sbUser));
        return;
      }
      setUser(null);
      clearIdentityHintFromDocument();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      // Keep optimistic session on challenge / network blips.
      if (code !== "security_challenge" && code !== "invalid_json") {
        const supabase = createClient();
        const {
          data: { user: sbUser },
        } = await supabase.auth.getUser().catch(() => ({
          data: { user: null },
        }));
        if (sbUser?.id) {
          setUser(sessionFromSupabaseUser(sbUser));
        } else if (!opts?.quiet) {
          setUser(null);
        }
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Instant JWT bootstrap (ChatGPT/Claude: paint identity before BFF).
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && session?.user) {
          setUser((prev) => prev ?? sessionFromSupabaseUser(session.user));
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) await refresh({ quiet: true });
      if (!cancelled) setLoading(false);
      // Background profile sync — keep ensureUserRecord off the FCP path.
      if (!cancelled) {
        void authApi
          .getSession()
          .then((session) => {
            if (!cancelled && session) setUser(session);
          })
          .catch(() => {});
      }
    })();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser((prev) => {
          const next = sessionFromSupabaseUser(session.user);
          if (prev?.id === next.id) {
            return {
              ...next,
              displayName: prev.displayName ?? next.displayName,
              preferredName: prev.preferredName ?? next.preferredName,
              avatarUrl: prev.avatarUrl ?? next.avatarUrl,
            };
          }
          return next;
        });
      }
      void refresh({ quiet: true });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refresh]);

  // Live profile updates (onboarding name, settings) → sidebar + welcome
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`profile-self:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            display_name?: string | null;
            preferred_name?: string | null;
            avatar_url?: string | null;
            email?: string | null;
          } | null;
          if (!row || typeof row !== "object") return;
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  displayName:
                    row.display_name !== undefined
                      ? row.display_name
                      : prev.displayName,
                  preferredName:
                    row.preferred_name !== undefined
                      ? row.preferred_name
                      : prev.preferredName,
                  avatarUrl:
                    row.avatar_url !== undefined
                      ? row.avatar_url
                      : prev.avatarUrl,
                  email: row.email !== undefined ? row.email : prev.email,
                }
              : prev,
          );
        },
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logSupabaseQueryError(
            "realtime.profiles",
            err ?? { message: status },
            {
              table: "profiles",
              filter: `id=eq.${user.id}`,
              userId: user.id,
            },
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const login = useCallback(async (email: string, password: string) => {
    await authApi.validateEmail(email);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new Error(mapSupabaseAuthError(error.message));
    }

    const session = await authApi.getSession();
    const next =
      session ??
      (data.user
        ? sessionFromSupabaseUser(data.user)
        : {
            id: "",
            email: null,
            displayName: null,
            preferredName: null,
            avatarUrl: null,
          });
    setUser(next);
    return next;
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName?: string;
    }) => {
      await authApi.validateEmail(input.email);
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: input.displayName
            ? { display_name: input.displayName.trim() }
            : undefined,
          emailRedirectTo: `${appOrigin()}/auth/callback`,
        },
      });
      if (error) {
        throw new Error(mapSupabaseAuthError(error.message));
      }

      if (data.session) {
        const session = await authApi.getSession();
        const next = session ?? sessionFromSupabaseUser(data.user!);
        setUser(next);
        return next;
      }

      throw new Error(
        "Check your email to confirm your account, then sign in.",
      );
    },
    [],
  );

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider, redirectTo = "/new") => {
      const supabase = createClient();
      const { provider: goTrueProvider, scopes } =
        oauthSignInOptions(provider);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: goTrueProvider,
        options: {
          redirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          ...(scopes ? { scopes } : {}),
        },
      });
      if (error) {
        throw new Error(mapSupabaseAuthError(error.message));
      }
    },
    [],
  );

  const signInWithMagicLink = useCallback(
    async (email: string, redirectTo = "/new") => {
      await authApi.validateEmail(email);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) {
        throw new Error(mapSupabaseAuthError(error.message));
      }
    },
    [],
  );

  const signInWithPhoneOtp = useCallback(async (phone: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.trim(),
    });
    if (error) {
      throw new Error(mapSupabaseAuthError(error.message));
    }
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: token.trim(),
      type: "sms",
    });
    if (error) {
      throw new Error(mapSupabaseAuthError(error.message));
    }
    const session = await authApi.getSession();
    const next =
      session ??
      (data.user
        ? sessionFromSupabaseUser(data.user)
        : {
            id: "",
            email: null,
            displayName: null,
            preferredName: null,
            avatarUrl: null,
          });
    setUser(next);
    return next;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await authApi.validateEmail(email);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${appOrigin()}/auth/confirm?type=recovery`,
    });
    if (error) {
      throw new Error(mapSupabaseAuthError(error.message));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await authApi.logout();
    } finally {
      clearIdentityHintFromDocument();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user?.id),
      login,
      register,
      signInWithOAuth,
      signInWithMagicLink,
      signInWithPhoneOtp,
      verifyPhoneOtp,
      resetPassword,
      logout,
      refresh,
    }),
    [
      user,
      loading,
      login,
      register,
      signInWithOAuth,
      signInWithMagicLink,
      signInWithPhoneOtp,
      verifyPhoneOtp,
      resetPassword,
      logout,
      refresh,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
