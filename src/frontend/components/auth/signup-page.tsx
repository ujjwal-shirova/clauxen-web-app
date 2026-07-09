"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/frontend/hooks/use-auth";
import {
  AuthOAuthButtons,
  AuthEmailForm,
  AuthLoadingShell,
  authPageStyles,
  getSafeRedirectTo,
  mapSupabaseAuthError,
  type OAuthProvider,
} from "@/frontend/components/auth/auth-shared";
import { AuthShell } from "@/frontend/components/auth/auth-shell";

export function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));
  const urlError = searchParams.get("error");

  const {
    register,
    signInWithOAuth,
    signInWithMagicLink,
    isAuthenticated,
    loading,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? mapSupabaseAuthError(decodeURIComponent(urlError)) : null,
  );
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [loading, isAuthenticated, redirectTo, router]);

  const handleOAuth = useCallback(
    async (provider: OAuthProvider) => {
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      if (useMagicLink) {
        await signInWithMagicLink(email, redirectTo);
        setInfo("Check your email for a magic link to continue.");
        return;
      }

      await register({
        email,
        password,
        displayName: displayName || undefined,
      });
      router.replace(redirectTo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <AuthLoadingShell />;
  }

  const loginHref = `/login?redirectTo=${encodeURIComponent(redirectTo)}`;

  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-6">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
          Create your account
        </h1>

        <div className="mt-7">
          <AuthOAuthButtons
            onOAuth={handleOAuth}
            onSso={() => {
              setError(null);
              setInfo(
                "Enterprise SSO is available on Team plans — contact sales@clauxen.com.",
              );
            }}
            disabled={submitting}
          />
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            or
          </span>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

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
              <>
                <label className="sr-only" htmlFor="auth-name">
                  Display name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Display name (optional)"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={authPageStyles.input}
                />
              </>
            ) : null
          }
          error={error}
          info={info}
          submitting={submitting}
          submitLabel={useMagicLink ? "Email me a link" : "Create account"}
          onSubmit={handleEmailSubmit}
        />

        <p className="mt-5 text-[12px] leading-relaxed text-zinc-500">
          By clicking continue, you agree to our{" "}
          <a
            href="/legal/terms"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/legal/privacy"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
          >
            Privacy Policy
          </a>
          .
        </p>

        <p className="mt-4 text-[13px] text-zinc-600">
          Already have an account?{" "}
          <a
            href={loginHref}
            className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2"
          >
            Sign in
          </a>
        </p>
      </div>

      <p className="mx-auto mt-auto max-w-[380px] pb-2 text-center text-[12px] leading-relaxed text-zinc-400">
        Need help with your account?{" "}
        <a
          href="mailto:support@clauxen.com"
          className="text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
        >
          Get in touch
        </a>
      </p>
    </AuthShell>
  );
}
