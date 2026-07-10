import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/backend/config/env";
import {
  DISPOSABLE_EMAIL_MESSAGE,
  isDisposableEmailSafe,
} from "@/backend/email-verifier/disposable-email";
import { getSupabasePublicConfig, requireSupabasePublicConfig } from "./env";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth/",
  "/share/",
  "/legal/",
  "/about",
] as const;

function isPublicPath(pathname: string) {
  if (pathname === "/about") return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (pathname.startsWith("/api/")) return true;
  return false;
}

function withSessionCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
  return to;
}

/**
 * Fail closed: missing row / query error → incomplete → /onboarding.
 * Uses the Edge-safe Supabase client (not pg) so the gate actually runs.
 */
async function isOnboardingComplete(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("onboarding_completed_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return false;
    return Boolean(data?.onboarding_completed_at);
  } catch {
    return false;
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const publicConfig = getSupabasePublicConfig();
  if (!publicConfig.url || !publicConfig.publishableKey) {
    return supabaseResponse;
  }

  const { url, publishableKey } = requireSupabasePublicConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        const isProduction = process.env.NODE_ENV === "production";
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, {
            ...options,
            httpOnly: options?.httpOnly ?? true,
            sameSite: options?.sameSite ?? "lax",
            secure: isProduction ? true : options?.secure,
            path: options?.path ?? "/",
          });
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Hard gate: disposable sessions cannot use the app (DevTools / direct API bypass).
  if (
    user?.email &&
    isDisposableEmailSafe(user.email) &&
    !pathname.startsWith("/api/") &&
    pathname !== "/login" &&
    pathname !== "/signup"
  ) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("error", DISPOSABLE_EMAIL_MESSAGE);
    return withSessionCookies(
      supabaseResponse,
      NextResponse.redirect(loginUrl),
    );
  }

  const devSession = env.authDevBypass
    ? request.cookies.get(env.sessionCookieName)?.value
    : null;
  const isAuthenticated = Boolean(user?.id || devSession);

  // Unauthenticated app routes (including `/`) → login. `/about` stays public
  // for Google OAuth branding verification.
  if (!isPublicPath(pathname) && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    );
    return withSessionCookies(
      supabaseResponse,
      NextResponse.redirect(loginUrl),
    );
  }

  const userId = user?.id ?? null;

  // New / incomplete users must finish onboarding before the app.
  // Dev-bypass cookie alone has no Supabase JWT → treat as incomplete.
  if (
    isAuthenticated &&
    !isPublicPath(pathname) &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api/")
  ) {
    const complete = userId
      ? await isOnboardingComplete(supabase, userId)
      : false;
    if (!complete) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      onboardingUrl.search = "";
      return withSessionCookies(
        supabaseResponse,
        NextResponse.redirect(onboardingUrl),
      );
    }
  }

  // Completed users who land on /onboarding → home.
  if (isAuthenticated && pathname === "/onboarding" && userId) {
    const complete = await isOnboardingComplete(supabase, userId);
    if (complete) {
      const home = request.nextUrl.clone();
      home.pathname = "/";
      home.search = "";
      return withSessionCookies(supabaseResponse, NextResponse.redirect(home));
    }
  }

  if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
    // Don't bounce disposable users back into the app from the login splash.
    if (user?.email && isDisposableEmailSafe(user.email)) {
      return supabaseResponse;
    }
    const complete = userId
      ? await isOnboardingComplete(supabase, userId)
      : false;
    const dest = request.nextUrl.clone();
    dest.pathname = complete ? "/" : "/onboarding";
    dest.search = "";
    return withSessionCookies(supabaseResponse, NextResponse.redirect(dest));
  }

  return supabaseResponse;
}
