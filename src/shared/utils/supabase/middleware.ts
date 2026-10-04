import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database.types";
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
import { getClaimsFromCookies } from "@/server/auth/jwt";

/**
 * Paths anyone may open with no session at all (auth screens, share links,
 * legal pages). No onboarding gate either. `/login` is intentionally absent —
 * it no longer renders; it redirects into the app preview (see below).
 */
const AUTH_FREE_PREFIXES = [
  "/signup",
  "/auth/",
  "/share/",
  "/gift/",
  "/legal/",
] as const;

/**
 * App-shell preview paths — unauthenticated guests see the full app here
 * as a live preview. Actions (send, history, protected nav) open the in-app
 * auth gate dialog instead of bouncing to a standalone login page.
 */
const GUEST_PREVIEW_EXACT_PATHS = ["/new", "/pricing", "/platform"] as const;

const SESSION_COOKIE_NAME = "clauxen_session";

function authDevBypassEnabled() {
  const isVercel = process.env.VERCEL === "1";
  const isProduction =
    process.env.NODE_ENV === "production" || isVercel;
  if (isProduction) return false;
  return process.env.AUTH_DEV_BYPASS?.trim() === "true";
}

function isAuthFreePath(pathname: string) {
  if (AUTH_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (pathname.startsWith("/api/")) return true;
  // Clauxen Code CLI preflight probe (not under /api/)
  if (pathname === "/v1/oauth/hello") return true;
  return false;
}

function isGuestPreviewPath(pathname: string) {
  return GUEST_PREVIEW_EXACT_PATHS.some((path) => path === pathname);
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
    onboardingDoneCookieOptions(complete),
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
  if (isAuthFreePath(pathname)) {
    return supabaseResponse;
  }

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

  // Verify the access token locally (ES256 via cached JWKS). Only when the
  // token is missing/expired but a session cookie exists do we call GoTrue —
  // getUser() then refreshes once and setAll() persists the rotated cookies.
  type ProxyUser = {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
  const claims = await getClaimsFromCookies(request.cookies);
  let user: ProxyUser | null = claims
    ? {
        id: claims.sub,
        email: claims.email ?? null,
        user_metadata: claims.user_metadata ?? null,
      }
    : null;
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name) &&
        !cookie.name.endsWith("-code-verifier"),
    );

  if (!user && hasAuthCookie) {
    const {
      data: { user: remoteUser },
    } = await supabase.auth.getUser();
    user = remoteUser
      ? {
          id: remoteUser.id,
          email: remoteUser.email ?? null,
          user_metadata: remoteUser.user_metadata ?? null,
        }
      : null;
  }

  // Fast UI identity hint (non-HttpOnly) for early paint.
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
    supabaseResponse.cookies.set(SESSION_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
    });
  }

  // Disposable-email enforcement lives on signup + /api/v1/auth/session —
  // never on the document proxy (that path used to read a 1MB blocklist).

  const devSession = authDevBypassEnabled()
    ? request.cookies.get(SESSION_COOKIE_NAME)?.value
    : null;
  const isAuthenticated = Boolean(user?.id || devSession);

  // The standalone login page is gone: `/login` deep links (bookmarks,
  // provider error returns) land on the app preview with the in-app sign-in
  // dialog open — the same form, as a popup over the live app.
  if (
    !isAuthenticated &&
    (pathname === "/login" || pathname.startsWith("/login/"))
  ) {
    const gateUrl = request.nextUrl.clone();
    gateUrl.pathname = "/new";
    gateUrl.search = "";
    gateUrl.searchParams.set("auth", "1");
    gateUrl.searchParams.set(
      "redirectTo",
      request.nextUrl.searchParams.get("redirectTo") || "/",
    );
    const oauthError = request.nextUrl.searchParams.get("error");
    if (oauthError) gateUrl.searchParams.set("error", oauthError);
    return withSessionCookies(supabaseResponse, NextResponse.redirect(gateUrl));
  }

  // Guests see the app as a live preview — no standalone login page. Any
  // route that needs a session bounces to the preview with the in-app auth
  // gate dialog open (`?auth=1`), preserving the original destination.
  if (
    !isAuthFreePath(pathname) &&
    !isGuestPreviewPath(pathname) &&
    !isAuthenticated
  ) {
    const gateUrl = request.nextUrl.clone();
    gateUrl.pathname = "/new";
    gateUrl.search = "";
    gateUrl.searchParams.set("auth", "1");
    gateUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    );
    return withSessionCookies(supabaseResponse, NextResponse.redirect(gateUrl));
  }

  const userId = user?.id ?? null;

  // New / incomplete users must finish onboarding before the app.
  // Dev-bypass cookie alone has no Supabase JWT → treat as incomplete.
  // CLI OAuth consent/device pages must work even if web onboarding is incomplete.
  if (
    isAuthenticated &&
    !isAuthFreePath(pathname) &&
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
