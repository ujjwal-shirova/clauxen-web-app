"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/frontend/hooks/use-auth";
import { useClearAuthBusyOnReturn } from "@/frontend/hooks/use-clear-auth-busy-on-return";
import {
  AuthOAuthButtons,
  AuthEmailForm,
  AuthLoadingShell,
  getSafeRedirectTo,
  mapSupabaseAuthError,
  redirectTargetWithHash,
  resolveAuthIdentifier,
  type OAuthProvider,
} from "@/frontend/components/auth/auth-shared";
import { AuthShell } from "@/frontend/components/auth/auth-shell";
import { looksLikePhone, PHONE_COUNTRIES } from "@/frontend/lib/phone-countries";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));
  const urlError = searchParams.get("error");

  const {
    login,
    signInWithOAuth,
    signInWithMagicLink,
    signInWithPhoneOtp,
    verifyPhoneOtp,
    resetPassword,
    isAuthenticated,
    loading,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [countryIso, setCountryIso] = useState("IN");
  const [otpCode, setOtpCode] = useState("");
  const [awaitingPhoneOtp, setAwaitingPhoneOtp] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<
    OAuthProvider | "sso" | null
  >(null);
  const [error, setError] = useState<string | null>(
    urlError ? mapSupabaseAuthError(decodeURIComponent(urlError)) : null,
  );
  const [info, setInfo] = useState<string | null>(null);

  const clearBusy = useCallback(() => {
    setPendingProvider(null);
    setFormSubmitting(false);
  }, []);
  useClearAuthBusyOnReturn(clearBusy);

  useEffect(() => {
    try {
      const region = (navigator.language.split("-")[1] || "").toUpperCase();
      if (region && PHONE_COUNTRIES.some((c) => c.iso === region)) {
        setCountryIso(region);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(redirectTargetWithHash(redirectTo));
    }
  }, [loading, isAuthenticated, redirectTo, router]);

  const handleOAuth = useCallback(
    async (provider: OAuthProvider) => {
      setError(null);
      setPendingProvider(provider);
      try {
        await signInWithOAuth(provider, redirectTo);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Sign in failed. Try again.",
        );
        setPendingProvider(null);
      }
    },
    [redirectTo, signInWithOAuth],
  );

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setFormSubmitting(true);

    try {
      if (awaitingPhoneOtp && pendingPhone) {
        await verifyPhoneOtp(pendingPhone, otpCode);
        router.replace(redirectTargetWithHash(redirectTo));
        return;
      }

      const id = resolveAuthIdentifier(email, countryIso);
      if (id.kind === "invalid") {
        setError(id.message);
        setFormSubmitting(false);
        return;
      }

      if (id.kind === "phone") {
        await signInWithPhoneOtp(id.value);
        setPendingPhone(id.value);
        setAwaitingPhoneOtp(true);
        setInfo("We sent a verification code to your phone.");
        setFormSubmitting(false);
        return;
      }

      if (useMagicLink) {
        await signInWithMagicLink(id.value, redirectTo);
        setInfo("Check your email for a magic link to continue.");
        setFormSubmitting(false);
        return;
      }

      await login(id.value, password);
      router.replace(redirectTargetWithHash(redirectTo));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      setFormSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email first, then click forgot password.");
      return;
    }
    const id = resolveAuthIdentifier(email, countryIso);
    if (id.kind !== "email") {
      setError("Password reset works with email addresses only.");
      return;
    }
    setError(null);
    setInfo(null);
    setFormSubmitting(true);
    try {
      await resetPassword(id.value);
      setInfo("Password reset link sent. Check your email.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send reset email.",
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  if (loading) {
    return <AuthLoadingShell />;
  }

  const signupHref = `/signup?redirectTo=${encodeURIComponent(redirectTo)}`;
  const busy = formSubmitting || pendingProvider != null;
  const phoneMode = looksLikePhone(email) || awaitingPhoneOtp;
  const submitLabel = awaitingPhoneOtp
    ? "Verify code"
    : phoneMode
      ? "Continue with phone"
      : useMagicLink
        ? "Email me a link"
        : "Continue with email";

  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-6">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
          Welcome to Clauxen
        </h1>

        <div className="mt-7">
          <AuthOAuthButtons
            onOAuth={handleOAuth}
            onSso={() => {
              setError(null);
              setPendingProvider("sso");
              window.setTimeout(() => {
                setPendingProvider(null);
                setInfo(
                  "Enterprise SSO is available on Team plans — contact sales@clauxen.com.",
                );
              }, 450);
            }}
            disabled={busy}
            pendingProvider={pendingProvider}
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
          onEmailChange={(v) => {
            setEmail(v);
            if (awaitingPhoneOtp) {
              setAwaitingPhoneOtp(false);
              setPendingPhone(null);
              setOtpCode("");
            }
          }}
          onPasswordChange={setPassword}
          onToggleMagicLink={() => setUseMagicLink((v) => !v)}
          countryIso={countryIso}
          onCountryChange={setCountryIso}
          otpCode={otpCode}
          onOtpChange={setOtpCode}
          awaitingPhoneOtp={awaitingPhoneOtp}
          error={error}
          info={info}
          submitting={formSubmitting}
          submitLabel={submitLabel}
          onSubmit={handleEmailSubmit}
          onForgotPassword={() => void handleForgotPassword()}
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
          Don&apos;t have an account yet?{" "}
          <a
            href={signupHref}
            className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2"
          >
            Sign up
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
