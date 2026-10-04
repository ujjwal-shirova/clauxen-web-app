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
import { clearSupabaseAccessTokenSingleflight } from "@/lib/supabase-session-singleflight";
import { clearSyncDeviceChatList } from "@/lib/device-chat-cache";

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

/**
 * Drop the browser Supabase session only when one exists. Calling signOut()
 * unconditionally (e.g. for guests) emits SIGNED_OUT, re-triggers refresh,
 * and wipes in-flight auth state — so guard it.
 */
async function clearLocalSupabaseSession() {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* ignore */
  }
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

let oauthNavigationStarted = false;

export function resetOAuthNavigation() {
  oauthNavigationStarted = false;
  if (typeof document !== "undefined") {
    document.documentElement.removeAttribute("data-auth-redirect");
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => hintToSession());
  // Identity hint means we already know who you are — do not
  // block the shell on the quiet session round-trip.
  const [loading, setLoading] = useState(() => !hintToSession());

  useEffect(() => {
    const handleReset = () => resetOAuthNavigation();
    window.addEventListener("pageshow", handleReset);
    window.addEventListener("focus", handleReset);
    const onVisibility = () => {
      if (document.visibilityState === "visible") resetOAuthNavigation();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", handleReset);
      window.removeEventListener("focus", handleReset);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

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
      // Authoritative API returned null session (e.g. account removed or signed out)
      setUser(null);
      clearIdentityHintFromDocument();
      clearSupabaseAccessTokenSingleflight();
      clearSyncDeviceChatList();
      await clearLocalSupabaseSession();
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status?: number }).status)
          : 0;

      // Definite unauthenticated or account deleted signal from server
      if (
        code === "account_deleted" ||
        code === "unauthorized" ||
        status === 401 ||
        status === 403
      ) {
        setUser(null);
        clearIdentityHintFromDocument();
        clearSupabaseAccessTokenSingleflight();
        clearSyncDeviceChatList();
        await clearLocalSupabaseSession();
        return;
      }

      // Check local in-memory session on transient network errors
      if (code !== "security_challenge" && code !== "invalid_json") {
        try {
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            setUser(sessionFromSupabaseUser(session.user));
          } else if (!opts?.quiet) {
            setUser(null);
          }
        } catch {
          if (!opts?.quiet) setUser(null);
        }
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);


  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Instant JWT bootstrap — paint identity before BFF.
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && session?.user) {
          setUser((prev) => prev ?? sessionFromSupabaseUser(session.user));
          setLoading(false);
        } else if (!cancelled && hintToSession()) {
          setLoading(false);
        }
      } catch {
        if (!cancelled && hintToSession()) setLoading(false);
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
    } = supabase.auth.onAuthStateChange((event, session) => {
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
      // INITIAL_SESSION is handled by the bootstrap above; TOKEN_REFRESHED
      // needs no BFF round-trip; SIGNED_OUT is already terminal. Refreshing
      // on those caused a SIGNED_OUT → refresh → signOut loop for guests.
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void refresh({ quiet: true });
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refresh]);

  // Live profile updates & deletion handling when admin modifies user in Supabase
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
          if (payload.eventType === "DELETE") {
            // Admin removed user from Supabase — log out immediately
            clearIdentityHintFromDocument();
            clearSupabaseAccessTokenSingleflight();
            clearSyncDeviceChatList();
            setUser(null);
            void clearLocalSupabaseSession();
            return;
          }
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
      if (oauthNavigationStarted) return;
      oauthNavigationStarted = true;
      // If the page is kept (bfcache / blocked navigation), unlock the button.
      window.setTimeout(() => {
        oauthNavigationStarted = false;
      }, 8000);
      // Validate locally so typos fail fast instead of on the server.
      oauthSignInOptions(provider);
      document.documentElement.setAttribute("data-auth-redirect", "1");
      // Server mints the PKCE verifier as an HttpOnly cookie on this origin
      // and 303-redirects to the provider. Nothing in client storage to lose.
      const qs = new URLSearchParams({ provider, next: redirectTo });
      window.location.assign(`${window.location.origin}/auth/oauth?${qs.toString()}`);
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
    } catch (e) {
      console.warn("[auth] signOut error:", e);
    } finally {
      clearIdentityHintFromDocument();
      clearSupabaseAccessTokenSingleflight();
      clearSyncDeviceChatList();
      setUser(null);
      if (typeof window !== "undefined") {
        window.location.replace(`${window.location.origin}/new`);
      }
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
