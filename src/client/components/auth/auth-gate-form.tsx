"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useClearAuthBusyOnReturn } from "@/hooks/use-clear-auth-busy-on-return";
import {
  AuthOAuthButtons,
  AuthSpinner,
  authPageStyles,
  mapSupabaseAuthError,
  type OAuthProvider,
} from "@/components/auth/auth-shared";
import { SignupOtpDialog } from "@/components/auth/signup-otp-dialog";
import { ClauxenWordmark } from "@/components/auth/clauxen-wordmark";
import * as authApi from "@/lib/api/auth";
import { redirectTargetWithHash } from "@/lib/auth-redirect";
import { looksLikeEmail } from "@/lib/phone-countries";
import { cn } from "@/lib/utils";

type EmailStep = "chooser" | "email" | "login" | "create" | "magic" | "magic-sent";

export interface AuthGateFormProps {
  /** Where a successful sign-in should land (already sanitized). */
  redirectTo?: string;
  /** Decode `?error=` once on mount (page URL carries OAuth failures). */
  initialError?: string | null;
  /**
   * Called after a completed sign-in that keeps the document in place
   * (email/password + OTP). OAuth navigates away to the provider itself.
   */
  onAuthenticated?: (target: string) => void;
  /** Dialog renders the identical form inside a scrollable container. */
  variant?: "page" | "dialog";
}

/**
 * The full Clauxen sign-in form (provider buttons + email flows + magic link).
 *
 * Rendered inside the in-app auth gate dialog — the standalone `/login` page
 * is gone and redirects here, so this is the one and only sign-in form.
 */
export function AuthGateForm({
  redirectTo = "/new",
  initialError = null,
  onAuthenticated,
  variant = "page",
}: AuthGateFormProps) {
  const { login, signInWithOAuth, resetPassword } = useAuth();

  const [step, setStep] = useState<EmailStep>("chooser");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(
    null,
  );
  const [error, setError] = useState<string | null>(
    initialError ? mapSupabaseAuthError(decodeURIComponent(initialError)) : null,
  );

  // Sync incoming initialError (e.g. from OAuth redirect failure)
  useEffect(() => {
    if (initialError) {
      setError(mapSupabaseAuthError(decodeURIComponent(initialError)));
    }
  }, [initialError]);
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

  const busy = formSubmitting || pendingProvider != null;

  const finishSignIn = useCallback(
    (target = redirectTo) => {
      onAuthenticated?.(redirectTargetWithHash(target));
    },
    [onAuthenticated, redirectTo],
  );

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
      if (pendingProvider) return;
      setError(null);
      setInfo(null);
      setPendingProvider(provider);
      try {
        await signInWithOAuth(provider, redirectTo);
      } catch (err) {
        document.documentElement.removeAttribute("data-auth-redirect");
        setError(
          err instanceof Error ? err.message : "Sign in failed. Try again.",
        );
        setPendingProvider(null);
      }
    },
    [pendingProvider, redirectTo, signInWithOAuth],
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
        finishSignIn();
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
      finishSignIn();
    } catch (err) {
      setOtpError(
        err instanceof Error ? err.message : "Verification failed. Try again.",
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

  const providerName =
    pendingProvider === "google"
      ? "Google"
      : pendingProvider === "github"
        ? "GitHub"
        : pendingProvider === "gitlab"
          ? "GitLab"
          : null;

  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col",
        variant === "dialog" && "flex-none",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-1 flex-col justify-center",
          variant === "dialog" ? "py-1 sm:py-2" : "py-6",
        )}
      >
        <div className="flex items-center">
          <ClauxenWordmark height={24} className="text-[var(--ui-fg)]" />
        </div>
        <h1 className="mt-5 text-[22px] sm:text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ui-fg)]">
          {step === "create"
            ? "Create account"
            : step === "login"
              ? "Welcome back"
              : step === "magic" || step === "magic-sent"
                ? "Magic link"
                : step === "email"
                  ? "Email"
                  : "Sign in to Clauxen"}
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--ui-fg-muted)]">
          {step === "chooser"
            ? "Choose your preferred sign-in method to continue."
            : step === "create"
              ? "Set a password for this email."
              : step === "login"
                ? "Enter the password for this account."
                : step === "magic"
                  ? "We’ll send a one-tap link. It expires in 5 minutes."
                  : step === "magic-sent"
                    ? "Open the link in your inbox to continue."
                    : "Use the email for your Clauxen account."}
        </p>

        {step === "chooser" ? (
          <>
            <div className="mt-6">
              <AuthOAuthButtons
                onOAuth={handleOAuth}
                disabled={busy}
                pendingProvider={pendingProvider}
              />
              {providerName ? (
                <p className="sr-only" role="status">
                  Opening {providerName} to authorize.
                </p>
              ) : null}
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--ui-border)]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ui-fg-subtle)]">
                or
              </span>
              <div className="h-px flex-1 bg-[var(--ui-border)]" />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={openEmailFlow}
              className={authPageStyles.outlinedBtn}
            >
              <svg
                className="h-[18px] w-[18px] shrink-0 text-[var(--ui-fg)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span>Continue with Email</span>
            </button>

            <div className="mt-3 flex justify-center">
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
              <p className="mt-4 text-[13px] text-[var(--ui-fg-muted)]">{info}</p>
            ) : null}
          </>
        ) : step === "magic-sent" ? (
          <div className="magic-link-enter mt-8">
            <div className="rounded-[14px] border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-5 py-6 text-center">
              <p className="magic-link-spark text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ui-fg-subtle)]">
                On its way
              </p>
              <p className="mt-3 text-[18px] font-semibold tracking-tight text-[var(--ui-fg)]">
                Link sent
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--ui-fg-muted)]">
                We sent a one-tap link to{" "}
                <span className="font-medium text-[var(--ui-fg)]">{email.trim()}</span>.
                It expires in 5 minutes.
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
              <p className="mt-4 text-center text-[13px] text-[var(--ui-fg-muted)]">{info}</p>
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
            className="mt-7 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-[13px] font-medium text-[var(--ui-fg)]"
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
                      className="block text-[13px] font-medium text-[var(--ui-fg)]"
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
                    className="mb-1.5 block text-[13px] font-medium text-[var(--ui-fg)]"
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
              <p className="mt-3 text-[13px] text-[var(--ui-fg-muted)]">{info}</p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !canContinueEmail}
              aria-busy={formSubmitting || undefined}
              className={cn(authPageStyles.primaryBtn, "mt-4")}
            >
              {formSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <AuthSpinner className="text-white dark:text-zinc-900" />
                  <span>Please wait…</span>
                </span>
              ) : step === "magic" ? (
                "Send magic link"
              ) : (
                "Continue"
              )}
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

        <p className="mt-6 text-[12px] leading-relaxed text-[var(--ui-fg-subtle)]">
          By continuing, you agree to the{" "}
          <a
            href="/legal/terms"
            className="text-[var(--ui-fg-muted)] underline decoration-[var(--ui-border)] underline-offset-2 hover:text-[var(--ui-fg)]"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/legal/privacy"
            className="text-[var(--ui-fg-muted)] underline decoration-[var(--ui-border)] underline-offset-2 hover:text-[var(--ui-fg)]"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>

      {variant === "page" ? (
        <p className="mt-auto pb-1 text-center text-[12px] leading-relaxed text-[var(--ui-fg-subtle)]">
          <a
            href="mailto:support@clauxen.com"
            className="text-[var(--ui-fg-muted)] underline decoration-[var(--ui-border)] underline-offset-2 hover:text-[var(--ui-fg)]"
          >
            Contact support
          </a>
        </p>
      ) : null}

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
    </div>
  );
}
