import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database.types";
import {
  DISPOSABLE_EMAIL_MESSAGE,
  isDisposableEmailSafe,
} from "@/server/email-verifier/disposable-email";
import { getSupabasePublicConfig, requireSupabasePublicConfig } from "./env";
import {
  ONBOARDING_DONE_COOKIE,
  onboardingDoneCookieOptions,
  onboardingDoneCookieValue,
} from "@/utils/onboarding-cookie";
import {
  IDENTITY_HINT_COOKIE,
  identityHintCookieOptions,
  identityHintCookieValue,
} from "@/utils/identity-cookie";
import { resolveAuthAvatarUrl, resolveAuthFullName } from "@/lib/profile-names";
import { logSupabaseQueryError } from "@/lib/supabase-query-error";
import { isMarketingPublicPath } from "@/marketing/lib/public-paths";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth/",
  "/share/",
  "/legal/",
  "/about",
] as const;

const SESSION_COOKIE_NAME = "clauxen_session";

function authDevBypassEnabled() {
  const isVercel = process.env.VERCEL === "1";
  const isProduction =
    process.env.NODE_ENV === "production" || isVercel;
  if (isProduction) return false;
  return process.env.AUTH_DEV_BYPASS?.trim() === "true";
}

function isPublicPath(pathname: string) {
  if (pathname === "/about") return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (isMarketingPublicPath(pathname)) return true;
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

function readOnboardingCache(
  request: NextRequest,
  userId: string,
): boolean | null {
  const raw = request.cookies.get(ONBOARDING_DONE_COOKIE)?.value;
  if (!raw) return null;
  const [id, flag] = raw.split(".");
  if (id !== userId) return null;
  if (flag === "1") return true;
  if (flag === "0") return false;
  return null;
}

function writeOnboardingCache(
  response: NextResponse,
  userId: string,
  complete: boolean,
) {
  response.cookies.set(
    ONBOARDING_DONE_COOKIE,
    onboardingDoneCookieValue(userId, complete),
    onboardingDoneCookieOptions(),
  );
}

/**
 * Fail closed: missing row / query error → incomplete → /onboarding.
 * Uses the Edge-safe Supabase client (not pg) so the gate actually runs.
 */
async function isOnboardingComplete(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("onboarding_completed_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logSupabaseQueryError("middleware.user_settings", error, {
        table: "user_settings",
        filter: `user_id=eq.${userId}`,
        userId,
      });
      return false;
    }
    return Boolean(data?.onboarding_completed_at);
  } catch {
    return false;
  }
}

async function resolveOnboardingComplete(
  request: NextRequest,
  response: NextResponse,
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const cached = readOnboardingCache(request, userId);
  if (cached != null) return cached;
  const complete = await isOnboardingComplete(supabase, userId);
  writeOnboardingCache(response, userId, complete);
  return complete;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const publicConfig = getSupabasePublicConfig();
  if (!publicConfig.url || !publicConfig.publishableKey) {
    return supabaseResponse;
  }

  const { url, publishableKey } = requireSupabasePublicConfig();
  const supabase = createServerClient<Database>(url, publishableKey, {
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

  // Prefer local JWT read for document gates. Only revalidate with Auth when
  // there is no session or the access token is missing / near expiry.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let user = session?.user ?? null;
  const expiresAtMs =
    typeof session?.expires_at === "number" ? session.expires_at * 1000 : 0;
  const needsRemoteValidation =
    !user ||
    !session?.access_token ||
    expiresAtMs < Date.now() + 5 * 60 * 1000;

  if (needsRemoteValidation) {
    const {
      data: { user: remoteUser },
    } = await supabase.auth.getUser();
    user = remoteUser;
  }

  // Fast UI identity hint (non-HttpOnly) — mirrors ChatGPT split-cookie pattern.
  if (user?.id) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const preferred =
      typeof meta.preferred_name === "string"
        ? meta.preferred_name.trim() || null
        : null;
    supabaseResponse.cookies.set(
      IDENTITY_HINT_COOKIE,
      identityHintCookieValue({
        id: user.id,
        email: user.email ?? null,
        displayName:
          resolveAuthFullName(meta) ??
          user.email?.split("@")[0] ??
          null,
        preferredName: preferred,
        avatarUrl: resolveAuthAvatarUrl(meta),
      }),
      identityHintCookieOptions(),
    );
  } else {
    supabaseResponse.cookies.set(IDENTITY_HINT_COOKIE, "", {
      ...identityHintCookieOptions(0),
      maxAge: 0,
    });
  }

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

  const devSession = authDevBypassEnabled()
    ? request.cookies.get(SESSION_COOKIE_NAME)?.value
    : null;
  const isAuthenticated = Boolean(user?.id || devSession);

  // Unauthenticated visitors may open marketing + auth/legal paths.
  // App shell routes (/, /new, /c/*, …) still require login.
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
  // CLI OAuth consent/device pages must work even if web onboarding is incomplete.
  if (
    isAuthenticated &&
    !isPublicPath(pathname) &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/cli/")
  ) {
    const complete = userId
      ? await resolveOnboardingComplete(
          request,
          supabaseResponse,
          supabase,
          userId,
        )
      : false;
    if (!complete) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      onboardingUrl.search = "";
      const redirect = withSessionCookies(
        supabaseResponse,
        NextResponse.redirect(onboardingUrl),
      );
      if (userId) writeOnboardingCache(redirect, userId, false);
      return redirect;
    }
  }

  // Completed users who land on /onboarding → home.
  if (isAuthenticated && pathname === "/onboarding" && userId) {
    const complete = await resolveOnboardingComplete(
      request,
      supabaseResponse,
      supabase,
      userId,
    );
    if (complete) {
      const home = request.nextUrl.clone();
      home.pathname = "/new";
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
      ? await resolveOnboardingComplete(
          request,
          supabaseResponse,
          supabase,
          userId,
        )
      : false;
    const dest = request.nextUrl.clone();
    dest.pathname = complete ? "/new" : "/onboarding";
    dest.search = "";
    return withSessionCookies(supabaseResponse, NextResponse.redirect(dest));
  }

  return supabaseResponse;
}
