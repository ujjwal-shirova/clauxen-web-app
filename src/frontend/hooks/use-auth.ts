"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import * as authApi from "@/frontend/lib/api/auth";
import type { SessionUser } from "@/frontend/lib/api/auth";
import {
  mapSupabaseAuthError,
  type OAuthProvider,
} from "@/frontend/components/auth/auth-shared";

function appOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:9002";
}

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    try {
      const session = await authApi.getSession();
      setUser(session);
    } catch {
      setUser(null);
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh({ quiet: true });
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  // Live profile updates (onboarding name, settings) → sidebar + welcome greeting
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
      .subscribe();

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
    setUser(session);
    return session ?? {
      id: data.user?.id ?? "",
      email: data.user?.email ?? null,
      displayName: null,
      preferredName: null,
      avatarUrl: null,
    };
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
        setUser(session);
        return session!;
      }

      throw new Error(
        "Check your email to confirm your account, then sign in.",
      );
    },
    [],
  );

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider, redirectTo = "/") => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${appOrigin()}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) {
        throw new Error(mapSupabaseAuthError(error.message));
      }
    },
    [],
  );

  const signInWithMagicLink = useCallback(
    async (email: string, redirectTo = "/") => {
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
    setUser(session);
    return session ?? {
      id: data.user?.id ?? "",
      email: data.user?.email ?? null,
      displayName: null,
      preferredName: null,
      avatarUrl: null,
    };
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
      setUser(null);
    }
  }, []);

  return {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    signInWithOAuth,
    signInWithMagicLink,
    signInWithPhoneOtp,
    verifyPhoneOtp,
    resetPassword,
    logout,
    refresh,
  };
}
