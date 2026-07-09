"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/frontend/hooks/use-auth";
import { cn } from "@/frontend/lib/utils";
import {
  AuthOAuthButtons,
  AuthEmailForm,
  authPageStyles,
  getSafeRedirectTo,
} from "@/frontend/components/auth/auth-shared";

export function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));
  const { register, signInWithOAuth, signInWithMagicLink, isAuthenticated, loading } =
    useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [loading, isAuthenticated, redirectTo, router]);

  const handleOAuth = useCallback(
    async (provider: "google" | "github" | "facebook" | "twitter") => {
      setError(null);
      setSubmitting(true);
      try {
        await signInWithOAuth(provider, redirectTo);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Sign up failed. Try again.",
        );
        setSubmitting(false);
      }
    },
    [redirectTo, signInWithOAuth],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      if (useMagicLink) {
        await signInWithMagicLink(email, redirectTo);
        setInfo("Check your email for a magic link to sign in.");
        return;
      }

      await register({ email, password, displayName: displayName || undefined });
      router.replace(redirectTo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign up failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center"
        style={{ backgroundColor: authPageStyles.pageBg }}
      >
        <div className="h-8 w-8 animate-pulse rounded-full bg-black/10" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: authPageStyles.pageBg }}>
      <div className="mx-auto flex min-h-[100dvh] w-[calc(100%-2rem)] max-w-lg flex-col justify-center py-12">
        <h1
          className="text-center font-serif text-4xl font-normal tracking-tight"
          style={{ color: authPageStyles.ink }}
        >
          Create your account
        </h1>

        <div
          className="mx-auto mt-8 w-full rounded-[32px] border-[0.5px] border-[rgba(31,30,29,0.15)] p-7 shadow-lg"
          style={{ backgroundColor: authPageStyles.pageBg }}
        >
          <AuthOAuthButtons
            onOAuth={handleOAuth}
            disabled={submitting}
          />

          <p
            className="my-4 text-center text-xs uppercase"
            style={{ color: authPageStyles.muted }}
          >
            or
          </p>

          <AuthEmailForm
            email={email}
            password={password}
            showPassword
            useMagicLink={useMagicLink}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onToggleMagicLink={() => setUseMagicLink((v) => !v)}
            extraFields={
              !useMagicLink ? (
                <input
                  type="text"
                  placeholder="Display name (optional)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={authPageStyles.input}
                  style={{ color: authPageStyles.ink }}
                />
              ) : null
            }
            error={error}
            info={info}
            submitting={submitting}
            submitLabel={useMagicLink ? "Email me a link" : "Create account"}
            onSubmit={handleSubmit}
          />
        </div>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link
            href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="underline decoration-zinc-400"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
