"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/frontend/hooks/use-auth";
import { PlansCarouselSection } from "@/frontend/components/subscription";
import {
  AuthOAuthButtons,
  AuthEmailForm,
  authPageStyles,
  getSafeRedirectTo,
  mapSupabaseAuthError,
} from "@/frontend/components/auth/auth-shared";

const HERO_VIDEO_SRC =
  "https://statics.moonshot.cn/kimi-web-seo/assets/claw-hero-D59VliO4.mp4";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));
  const urlError = searchParams.get("error");
  const heroRef = useRef<HTMLDivElement>(null);
  const {
    login,
    signInWithOAuth,
    signInWithMagicLink,
    resetPassword,
    isAuthenticated,
    loading,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const scrollToHero = useCallback(() => {
    heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleOAuth = useCallback(
    async (provider: "google" | "github" | "facebook" | "twitter") => {
      setError(null);
      setSubmitting(true);
      try {
        await signInWithOAuth(provider, redirectTo);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Sign in failed. Try again.",
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
        setInfo("Check your email for a magic link to sign in.");
        return;
      }

      await login(email, password);
      router.replace(redirectTo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign in failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email first, then click forgot password.");
      return;
    }
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await resetPassword(email);
      setInfo("Password reset link sent. Check your email.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send reset email.",
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
      <div
        id="sign-in-hero"
        ref={heroRef}
        className="mx-auto flex min-h-[100dvh] w-[calc(100%-2rem)] max-w-[1440px] flex-grow flex-col justify-center sm:w-[calc(100%-4rem)] md:w-[calc(100%-128px)]"
      >
        <main className="relative grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex min-h-[670px] w-full items-center py-6">
            <div className="flex h-full w-full flex-col items-center justify-between">
              <div aria-hidden className="h-0 w-full shrink-0" />

              <div className="w-full">
                <h2
                  className="mt-12 select-none text-center font-serif text-[40px] font-normal leading-[1.2] tracking-tight sm:text-[56px] sm:leading-[67.2px]"
                  style={{ color: authPageStyles.ink }}
                >
                  Think fast,
                  <br />
                  build faster
                </h2>

                <h3
                  className="mt-4 flex flex-col items-center text-center font-serif text-lg font-medium leading-[24.75px]"
                  style={{ color: authPageStyles.ink }}
                >
                  Brainstorm in chat, build with Clauxen
                </h3>

                <div
                  className="mx-auto mt-8 flex w-full min-w-[320px] max-w-[448px] flex-col rounded-[32px] border-[0.5px] border-[rgba(31,30,29,0.15)] p-7 text-center shadow-[0_4px_24px_rgba(0,0,0,0.016),0_4px_32px_rgba(0,0,0,0.016),0_2px_64px_rgba(0,0,0,0.01),0_16px_32px_rgba(0,0,0,0.01)]"
                  style={{ backgroundColor: authPageStyles.pageBg }}
                >
                  <AuthOAuthButtons onOAuth={handleOAuth} disabled={submitting} />

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
                    error={error}
                    info={info}
                    submitting={submitting}
                    submitLabel={
                      useMagicLink ? "Email me a link" : "Continue with email"
                    }
                    onSubmit={handleEmailSubmit}
                    forgotPasswordHref="#"
                  />

                  {!useMagicLink ? (
                    <button
                      type="button"
                      className="mt-2 text-xs text-zinc-500 underline"
                      onClick={() => void handleForgotPassword()}
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </div>

                <p className="mt-6 text-center text-sm text-zinc-600">
                  Don&apos;t have an account?{" "}
                  <Link
                    href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
                    className="underline decoration-zinc-400"
                  >
                    Sign up
                  </Link>
                </p>
              </div>

              <div aria-hidden className="mt-14 h-0 w-full shrink-0" />
            </div>
          </div>

          <div className="hidden w-full items-center justify-center lg:flex">
            <div className="mb-8 flex aspect-[1080/1350] w-full max-w-[576px] items-center justify-center rounded-2xl">
              <div className="relative flex h-full w-full items-center justify-center">
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#f5f4ed] shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                  <div className="h-full w-full overflow-hidden rounded-2xl border border-[rgba(31,30,29,0.15)] bg-[#faf9f5]">
                    <video
                      aria-hidden
                      tabIndex={-1}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    >
                      <source src={HERO_VIDEO_SRC} type="video/mp4" />
                    </video>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <section className="mx-auto w-[calc(100%-2rem)] max-w-[1152px] pb-24 pt-8 sm:w-[calc(100%-4rem)] md:w-[calc(100%-128px)]">
        <h2
          className="mb-8 text-center font-serif text-3xl font-medium tracking-tight sm:text-4xl"
          style={{ color: authPageStyles.ink }}
        >
          Explore Plans
        </h2>

        <PlansCarouselSection
          layout="all"
          ctaLabel="Try Claude"
          onCtaClick={scrollToHero}
        />

        <p className="mt-8 text-center text-xs text-zinc-500">
          Usage limits apply. Prices shown don&apos;t include applicable tax.
        </p>
      </section>
    </div>
  );
}
