"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/frontend/components/auth/auth-shell";
import {
  AuthLoadingShell,
  authPageStyles,
} from "@/frontend/components/auth/auth-shared";
import { useAuth } from "@/frontend/hooks/use-auth";
import * as authApi from "@/frontend/lib/api/auth";
import { cn } from "@/frontend/lib/utils";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}••@${domain}`;
  return `${local.slice(0, 2)}•••${local.slice(-1)}@${domain}`;
}

function MagicLinkSetupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const [inspecting, setInspecting] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyPulse, setReadyPulse] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/onboarding");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setError("This magic link is missing its key. Request a new one from login.");
        setInspecting(false);
        return;
      }
      setInspecting(true);
      setError(null);
      try {
        const result = await authApi.inspectMagicLink(token);
        if (cancelled) return;
        setEmail(result.email);
        setExpiresIn(result.expiresInSeconds);
        setReadyPulse(true);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "This magic link is no longer valid.",
        );
      } finally {
        if (!cancelled) setInspecting(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (expiresIn == null || expiresIn <= 0) return;
    const id = window.setInterval(() => {
      setExpiresIn((prev) => {
        if (prev == null) return prev;
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [email]);

  const canSubmit = useMemo(() => {
    return (
      Boolean(email) &&
      password.length >= 8 &&
      confirmPassword.length >= 8 &&
      password === confirmPassword &&
      !submitting &&
      (expiresIn == null || expiresIn > 0)
    );
  }, [email, password, confirmPassword, submitting, expiresIn]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token || !email) return;
      setError(null);
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setSubmitting(true);
      try {
        const created = await authApi.completeMagicSignup({
          token,
          password,
        });
        await login(created.email, password);
        router.replace("/onboarding");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not create your account. Try again.",
        );
        setSubmitting(false);
      }
    },
    [token, email, password, confirmPassword, login, router],
  );

  if (authLoading || inspecting) {
    return <AuthLoadingShell />;
  }

  return (
    <AuthShell>
      <div
        className={cn(
          "mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-6",
          readyPulse && "magic-link-enter",
        )}
      >
        <p className="magic-link-spark text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Magic link
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
          Create your password
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
          {email
            ? `You’re creating an account for ${maskEmail(email)}. Set a password to finish — no code needed.`
            : "This link opens a one-time door into Clauxen."}
        </p>

        {expiresIn != null && expiresIn > 0 ? (
          <p className="mt-3 text-[12px] font-medium text-zinc-400">
            Link expires in {Math.floor(expiresIn / 60)}:
            {String(expiresIn % 60).padStart(2, "0")}
          </p>
        ) : null}

        {error && !email ? (
          <div className="mt-8 rounded-[12px] border border-red-200 bg-red-50 px-4 py-4">
            <p className="text-[13px] text-red-700" role="alert">
              {error}
            </p>
            <a
              href="/login"
              className={cn(authPageStyles.textLink, "mt-3 inline-block")}
            >
              Back to login
            </a>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="mt-7 animate-in fade-in slide-in-from-bottom-2 duration-400"
          >
            <div className="mb-4 rounded-[12px] border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-zinc-50 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] text-white"
                  aria-hidden
                >
                  ✦
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-zinc-900">
                    Create Account
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                    Your email is already verified by this magic link. Choose a
                    password and continue.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="magic-password"
                  className="mb-1.5 block text-[13px] font-medium text-zinc-800"
                >
                  Create new password
                </label>
                <input
                  id="magic-password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  disabled={submitting || !email}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={authPageStyles.input}
                />
              </div>
              <div>
                <label
                  htmlFor="magic-confirm-password"
                  className="mb-1.5 block text-[13px] font-medium text-zinc-800"
                >
                  Enter password again
                </label>
                <input
                  id="magic-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  disabled={submitting || !email}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className={authPageStyles.input}
                />
              </div>
            </div>

            {error ? (
              <p className="mt-3 text-[13px] text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(authPageStyles.primaryBtn, "mt-4")}
            >
              {submitting ? "Creating your account…" : "Continue"}
            </button>

            <a
              href="/login"
              className={cn(
                authPageStyles.textLink,
                "mt-4 block w-full text-center",
              )}
            >
              Back to sign-in options
            </a>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={<AuthLoadingShell />}>
      <MagicLinkSetupInner />
    </Suspense>
  );
}
