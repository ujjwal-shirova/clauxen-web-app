"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useClearAuthBusyOnReturn } from "@/hooks/use-clear-auth-busy-on-return";
import {
  AuthOAuthButtons,
  AuthLoadingShell,
  authPageStyles,
  mapSupabaseAuthError,
  type OAuthProvider,
} from "@/components/auth/auth-shared";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupOtpDialog } from "@/components/auth/signup-otp-dialog";
import * as authApi from "@/lib/api/auth";
import {
  getSafeRedirectTo,
  redirectTargetWithHash,
} from "@/lib/auth-redirect";
import { looksLikeEmail } from "@/lib/phone-countries";
import { cn } from "@/lib/utils";

type EmailStep = "chooser" | "email" | "login" | "create" | "magic" | "magic-sent";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));
  const urlError = searchParams.get("error");

  const { login, signInWithOAuth, resetPassword, isAuthenticated, loading } =
    useAuth();

  const [step, setStep] = useState<EmailStep>("chooser");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<
    OAuthProvider | "sso" | null
  >(null);
  const [error, setError] = useState<string | null>(
    urlError ? mapSupabaseAuthError(decodeURIComponent(urlError)) : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [magicDebugUrl, setMagicDebugUrl] = useState<string | null>(null);

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);

  const clearBusy = useCallback(() => {
    setPendingProvider(null);
    setFormSubmitting(false);
  }, []);
  useClearAuthBusyOnReturn(clearBusy);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(redirectTargetWithHash(redirectTo));
    }
  }, [loading, isAuthenticated, redirectTo, router]);

  const busy = formSubmitting || pendingProvider != null;

  const canContinueEmail = useMemo(() => {
    if (step === "email" || step === "magic") return looksLikeEmail(email.trim());
    if (step === "login") {
      return looksLikeEmail(email.trim()) && password.length > 0;
    }
    if (step === "create") {
      return (
        looksLikeEmail(email.trim()) &&
        password.length >= 8 &&
        confirmPassword.length >= 8 &&
        password === confirmPassword
      );
    }
    return false;
  }, [step, email, password, confirmPassword]);

  const handleOAuth = useCallback(
    async (provider: OAuthProvider) => {
      setError(null);
      setInfo(null);
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

  const openEmailFlow = () => {
    setError(null);
    setInfo(null);
    setMagicDebugUrl(null);
    setPassword("");
    setConfirmPassword("");
    setStep("email");
  };

  const openMagicFlow = () => {
    setError(null);
    setInfo(null);
    setMagicDebugUrl(null);
    setPassword("");
    setConfirmPassword("");
    setStep("magic");
  };

  const sendSignupOtp = async () => {
    const result = await authApi.requestSignupOtp(email.trim());
    setOtpInfo(
      result.delivered
        ? "Code sent. Check your inbox."
        : result.debugCode
          ? `Dev code: ${result.debugCode}`
          : "Code generated. Check your email.",
    );
  };

  const sendMagicLink = async () => {
    await authApi.validateEmail(email.trim());
    const result = await authApi.requestMagicLink(email.trim());
    setMagicDebugUrl(result.debugUrl ?? null);
    setInfo(
      result.delivered
        ? "Magic link sent — check your inbox. It expires in 5 minutes."
        : result.debugUrl
          ? "Dev magic link ready (email simulated)."
          : "Magic link generated. Check your email.",
    );
    setStep("magic-sent");
  };

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (step === "magic") {
      if (!looksLikeEmail(email.trim())) {
        setError("Enter a valid email address.");
        return;
      }
      setFormSubmitting(true);
      try {
        await sendMagicLink();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not send magic link. Try again.",
        );
      } finally {
        setFormSubmitting(false);
      }
      return;
    }

    if (step === "email") {
      if (!looksLikeEmail(email.trim())) {
        setError("Enter a valid email address.");
        return;
      }
      setFormSubmitting(true);
      try {
        await authApi.validateEmail(email.trim());
        const status = await authApi.checkEmailStatus(email.trim());
        setPassword("");
        setConfirmPassword("");
        setStep(status.exists ? "login" : "create");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not check that email. Try again.",
        );
      } finally {
        setFormSubmitting(false);
      }
      return;
    }

    if (step === "login") {
      if (!password) {
        setError("Enter your password.");
        return;
      }
      setFormSubmitting(true);
      try {
        await login(email.trim(), password);
        router.replace(redirectTargetWithHash(redirectTo));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Sign in failed. Try again.",
        );
        setFormSubmitting(false);
      }
      return;
    }

    if (step === "create") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setFormSubmitting(true);
      try {
        await sendSignupOtp();
        setOtpError(null);
        setOtpOpen(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not send verification code.",
        );
      } finally {
        setFormSubmitting(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!looksLikeEmail(email.trim())) {
      setError("Enter your email first, then click forgot password.");
      return;
    }
    setError(null);
    setInfo(null);
    setFormSubmitting(true);
    try {
      await resetPassword(email.trim());
      setInfo("Password reset link sent. Check your email.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send reset email.",
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOtpComplete = async (code: string) => {
    if (code.length !== 6 || otpSubmitting) return;
    setOtpSubmitting(true);
    setOtpError(null);
    try {
      await authApi.verifySignupAndCreate({
        email: email.trim(),
        code,
        password,
      });
      await login(email.trim(), password);
      setOtpOpen(false);
      router.replace(redirectTargetWithHash(redirectTo));
    } catch (err) {
      setOtpError(
        err instanceof Error
          ? err.message
          : "Verification failed. Try again.",
      );
      setOtpSubmitting(false);
    }
  };

  const handleOtpResend = async () => {
    setOtpError(null);
    setOtpSubmitting(true);
    try {
      await sendSignupOtp();
    } catch (err) {
      setOtpError(
        err instanceof Error ? err.message : "Could not resend code.",
      );
    } finally {
      setOtpSubmitting(false);
    }
  };

  if (loading) {
    return <AuthLoadingShell />;
  }

  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-6">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
          Welcome to Clauxen
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
          {step === "chooser"
            ? "Sign in or create an account to continue."
            : step === "create"
              ? "Create your account with email."
              : step === "login"
                ? "Welcome back — enter your password."
                : step === "magic"
                  ? "We’ll email you a magic link — no code to type."
                  : step === "magic-sent"
                    ? "Check your inbox — one tap and you’re in."
                    : "Continue with your email address."}
        </p>

        {step === "chooser" ? (
          <>
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

            <button
              type="button"
              disabled={busy}
              onClick={openEmailFlow}
              className={authPageStyles.outlinedBtn}
            >
              <i className="bi bi-envelope text-[16px] leading-none" aria-hidden />
              Continue with Email
            </button>

            <div className="mt-3.5 flex justify-center">
              <button
                type="button"
                disabled={busy}
                onClick={openMagicFlow}
                className={authPageStyles.textLink}
              >
                Email me a magic link
              </button>
            </div>

            {error ? (
              <p className="mt-4 text-[13px] text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="mt-4 text-[13px] text-zinc-600">{info}</p>
            ) : null}
          </>
        ) : step === "magic-sent" ? (
          <div className="magic-link-enter mt-8">
            <div className="rounded-[14px] border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-zinc-50 px-5 py-6 text-center">
              <p className="magic-link-spark text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                On its way
              </p>
              <p className="mt-3 text-[18px] font-semibold tracking-tight text-zinc-900">
                Your magic link is ready
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                We sent a one-tap link to{" "}
                <span className="font-medium text-zinc-800">{email.trim()}</span>.
                It expires in 5 minutes and creates your account the moment you
                open it.
              </p>
              {magicDebugUrl ? (
                <a
                  href={magicDebugUrl}
                  className={cn(authPageStyles.textLink, "mt-4 inline-block")}
                >
                  Open dev magic link
                </a>
              ) : null}
            </div>
            {info ? (
              <p className="mt-4 text-center text-[13px] text-zinc-600">{info}</p>
            ) : null}
            {error ? (
              <p className="mt-3 text-center text-[13px] text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setInfo(null);
                setMagicDebugUrl(null);
                setStep("magic");
              }}
              className={cn(authPageStyles.textLink, "mt-5 block w-full text-center")}
            >
              Use a different email
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setInfo(null);
                setMagicDebugUrl(null);
                setStep("chooser");
              }}
              className={cn(authPageStyles.textLink, "mt-3 block w-full text-center")}
            >
              Back to sign-in options
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleEmailContinue(e)}
            className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div className="mb-4 rounded-[12px] border border-zinc-200 bg-zinc-50 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    step === "magic"
                      ? "bg-zinc-900 text-[10px] text-white"
                      : "bg-zinc-200 text-zinc-700",
                  )}
                  aria-hidden
                >
                  {step === "magic" ? "✦" : "i"}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-zinc-900">
                    {step === "create"
                      ? "Create Account"
                      : step === "login"
                        ? "Sign in"
                        : step === "magic"
                          ? "Magic link"
                          : "Continue with Email"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                    {step === "create"
                      ? "This email is new — set a password to create your account."
                      : step === "login"
                        ? "We found an account for this email. Enter your password to continue."
                        : step === "magic"
                          ? "New email? We’ll send a 5-minute link that verifies you and opens password setup."
                          : "Create an account or log in via email."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-[13px] font-medium text-zinc-800"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus={step === "email" || step === "magic"}
                  value={email}
                  disabled={busy || step === "login" || step === "create"}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@host.com"
                  className={authPageStyles.input}
                />
              </div>

              {step === "login" || step === "create" ? (
                <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label
                      htmlFor="login-password"
                      className="block text-[13px] font-medium text-zinc-800"
                    >
                      {step === "create" ? "Create password" : "Password"}
                    </label>
                    {step === "login" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleForgotPassword()}
                        className={authPageStyles.textLink}
                      >
                        Forgot password?
                      </button>
                    ) : null}
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete={
                      step === "create" ? "new-password" : "current-password"
                    }
                    autoFocus
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      step === "create"
                        ? "At least 8 characters"
                        : "Enter your password"
                    }
                    className={authPageStyles.input}
                  />
                </div>
              ) : null}

              {step === "create" ? (
                <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <label
                    htmlFor="login-confirm-password"
                    className="mb-1.5 block text-[13px] font-medium text-zinc-800"
                  >
                    Confirm password
                  </label>
                  <input
                    id="login-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    disabled={busy}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Enter password again"
                    className={authPageStyles.input}
                  />
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="mt-3 text-[13px] text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="mt-3 text-[13px] text-zinc-600">{info}</p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !canContinueEmail}
              className={cn(authPageStyles.primaryBtn, "mt-4")}
            >
              {formSubmitting
                ? "Please wait…"
                : step === "magic"
                  ? "Send magic link"
                  : "Continue"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setInfo(null);
                setMagicDebugUrl(null);
                if (step === "email" || step === "magic") {
                  setStep("chooser");
                } else {
                  setPassword("");
                  setConfirmPassword("");
                  setStep("email");
                }
              }}
              className={cn(
                authPageStyles.textLink,
                "mt-3 block w-full text-center",
              )}
            >
              {step === "email" || step === "magic"
                ? "Back to sign-in options"
                : "Use a different email"}
            </button>
          </form>
        )}

        <p className="mt-5 text-[12px] leading-relaxed text-zinc-500">
          By continuing, you agree to our{" "}
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
      </div>

      <p className="mx-auto mt-auto max-w-[380px] pb-2 text-center text-[12px] leading-relaxed text-zinc-400">
        Need help?{" "}
        <a
          href="mailto:support@clauxen.com"
          className="text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
        >
          Get in touch
        </a>
      </p>

      <SignupOtpDialog
        open={otpOpen}
        email={email.trim()}
        submitting={otpSubmitting}
        error={otpError}
        info={otpInfo}
        onCodeComplete={(code) => void handleOtpComplete(code)}
        onResend={() => void handleOtpResend()}
        onClose={() => {
          if (otpSubmitting) return;
          setOtpOpen(false);
          setOtpError(null);
        }}
      />
    </AuthShell>
  );
}
