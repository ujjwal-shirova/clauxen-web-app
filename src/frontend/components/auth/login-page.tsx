"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/frontend/hooks/use-auth";
import { ApiError } from "@/frontend/lib/api/client";
import { cn } from "@/frontend/lib/utils";
import { PlansCarouselSection } from "@/frontend/components/subscription";

const HERO_VIDEO_SRC =
  "https://statics.moonshot.cn/kimi-web-seo/assets/claw-hero-D59VliO4.mp4";

const PAGE_BG = "#faf9f5";
const INK = "#141413";
const MUTED = "#3d3d3a";

function getSafeRedirectTo(value: string | null): string {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

function GoogleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M14.5 8.2c0-.5-.1-1-.2-1.4H8v2.7h3.7c-.2 1-1 2.3-2.1 3v1.8h3.4c2-1.8 3.1-4.5 3.1-7.1z"
        fill="#4285F4"
      />
      <path
        d="M8 15c2.7 0 5-0.9 6.6-2.4l-3.4-1.8c-.9.6-2.1 1-3.2 1-2.5 0-4.6-1.7-5.3-4H.5v1.9C2.1 13.1 4.9 15 8 15z"
        fill="#34A853"
      />
      <path
        d="M2.7 9.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V4.3H.5C-.2 5.7-.5 7.3-.5 9s.3 3.3 1 4.7l2.2-1.9z"
        fill="#FBBC05"
      />
      <path
        d="M8 3.6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C13 1.1 10.7 0 8 0 4.9 0 2.1 1.9.5 4.3l2.2 1.9C3.4 5.3 5.5 3.6 8 3.6z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function authErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) return "Sign in failed. Please try again.";
    return err.message;
  }
  return "Sign in failed. Please try again.";
}

const outlinedBtn =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[9.6px] border-[0.5px] border-[rgba(31,30,29,0.3)] bg-transparent px-5 text-sm font-medium text-[#141413] transition-colors hover:bg-black/[0.03]";

const primaryBtn =
  "flex h-11 w-full items-center justify-center rounded-[9.6px] bg-[#141413] px-5 text-sm font-medium text-white transition-colors hover:bg-[#272625]";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));
  const heroRef = useRef<HTMLDivElement>(null);
  const { login, isAuthenticated, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [loading, isAuthenticated, redirectTo, router]);

  const scrollToHero = useCallback(() => {
    heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleGoogleSignIn = () => {
    setError("Google sign-in is not configured.");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, showPassword ? password : "");
      router.replace(redirectTo);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === "invalid_credentials" &&
        !showPassword
      ) {
        setShowPassword(true);
        setError("Enter your password to continue.");
      } else {
        setError(authErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center"
        style={{ backgroundColor: PAGE_BG }}
      >
        <div className="h-8 w-8 animate-pulse rounded-full bg-black/10" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: PAGE_BG }}>
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
                  style={{ color: INK }}
                >
                  Think fast,
                  <br />
                  build faster
                </h2>

                <h3
                  className="mt-4 flex flex-col items-center text-center font-serif text-lg font-medium leading-[24.75px]"
                  style={{ color: INK }}
                >
                  Brainstorm in chat, build with Clauxen
                </h3>

                <div
                  className="mx-auto mt-8 flex w-full min-w-[320px] max-w-[448px] flex-col rounded-[32px] border-[0.5px] border-[rgba(31,30,29,0.15)] p-7 text-center shadow-[0_4px_24px_rgba(0,0,0,0.016),0_4px_32px_rgba(0,0,0,0.016),0_2px_64px_rgba(0,0,0,0.01),0_16px_32px_rgba(0,0,0,0.01)]"
                  style={{ backgroundColor: PAGE_BG }}
                >
                  <div className="mb-2 flex flex-col gap-5">
                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className={outlinedBtn}
                      >
                        <GoogleIcon />
                        Continue with Google
                      </button>

                      <p
                        className="pb-px text-center text-xs uppercase leading-4"
                        style={{ color: MUTED }}
                      >
                        or
                      </p>

                      <form
                        onSubmit={handleEmailSubmit}
                        className="flex min-w-[320px] flex-col gap-4 text-center"
                      >
                        <input
                          type="email"
                          placeholder="Enter your email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-11 w-full rounded-[9.6px] border border-[rgba(31,30,29,0.15)] bg-white px-3 text-sm font-medium outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-[rgba(31,30,29,0.35)] focus-visible:ring-2 focus-visible:ring-[rgba(44,132,219,0.15)]"
                          style={{ color: INK }}
                        />

                        {showPassword ? (
                          <input
                            type="password"
                            placeholder="Password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-11 w-full rounded-[9.6px] border border-[rgba(31,30,29,0.15)] bg-white px-3 text-sm font-medium outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-[rgba(31,30,29,0.35)] focus-visible:ring-2 focus-visible:ring-[rgba(44,132,219,0.15)]"
                            style={{ color: INK }}
                          />
                        ) : null}

                        {error ? (
                          <p className="text-sm text-red-600">{error}</p>
                        ) : null}

                        <button
                          type="submit"
                          disabled={submitting}
                          className={cn(primaryBtn, submitting && "opacity-70")}
                        >
                          {submitting ? "Please wait…" : "Continue with email"}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <button type="button" className={cn(outlinedBtn, "w-auto")}>
                    <span className="mr-2 flex h-5 w-5 items-center justify-center">
                      <AppleIcon />
                    </span>
                    Download desktop app
                  </button>
                </div>
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
          style={{ color: INK }}
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
