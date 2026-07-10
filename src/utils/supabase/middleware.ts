import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/backend/config/env";
import { queryOne } from "@/backend/db/pool";
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

async function isOnboardingComplete(userId: string): Promise<boolean> {
  if (!env.databaseUrl) return true;
  try {
    const row = await queryOne<{ onboarding_completed_at: string | null }>(
      `select onboarding_completed_at from public.user_settings where user_id = $1`,
      [userId],
    );
    return Boolean(row?.onboarding_completed_at);
  } catch {
    // ponytail: if column missing pre-migration, skip gate
    return true;
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

  const devSession = env.authDevBypass
    ? request.cookies.get(env.sessionCookieName)?.value
    : null;
  const isAuthenticated = Boolean(user?.id || devSession);

  // Unauthenticated apex → public about page (Google OAuth branding needs a
  // crawlable home page that explains the product + links privacy/terms).
  if (!isAuthenticated && pathname === "/") {
    const aboutUrl = request.nextUrl.clone();
    aboutUrl.pathname = "/about";
    aboutUrl.search = "";
    return NextResponse.redirect(aboutUrl);
  }

  if (!isPublicPath(pathname) && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  const userId = user?.id ?? devSession ?? null;

  if (
    userId &&
    !isPublicPath(pathname) &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api/")
  ) {
    const complete = await isOnboardingComplete(userId);
    if (!complete) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      onboardingUrl.search = "";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return supabaseResponse;
}
