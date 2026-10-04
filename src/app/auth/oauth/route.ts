import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabasePublicConfig } from "@/utils/supabase/env";
import { OAUTH_PROVIDER_OPTIONS } from "@/lib/oauth-providers";
import type { OAuthProvider } from "@/components/auth/auth-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/new";
  return raw === "/" ? "/new" : raw;
}

/**
 * Server-initiated OAuth sign-in.
 *
 * GET /auth/oauth?provider=google&next=/new
 *
 * The PKCE code verifier is generated here and stored as an HttpOnly cookie
 * on the same origin that `/auth/callback` runs on. Client JavaScript
 * (signOut, storage resets, extensions) can never delete it, and the browser
 * always sends it back on the provider → callback redirect.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const providerParam = request.nextUrl.searchParams.get("provider") ?? "";
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  const options =
    OAUTH_PROVIDER_OPTIONS[providerParam as OAuthProvider] ?? null;
  if (!options) {
    return NextResponse.redirect(
      `${origin}/new?auth=1&error=${encodeURIComponent("Unsupported sign-in provider.")}`,
    );
  }

  const isProduction = process.env.NODE_ENV === "production";
  const pendingCookies: {
    name: string;
    value: string;
    options: Record<string, unknown>;
  }[] = [];

  const { url, publishableKey } = requireSupabasePublicConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((c) => pendingCookies.push(c));
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: options.provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
      ...(options.scopes ? { scopes: options.scopes } : {}),
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(
      `${origin}/new?auth=1&error=${encodeURIComponent(
        error?.message ?? "Could not start sign-in. Try again.",
      )}`,
    );
  }

  const response = NextResponse.redirect(data.url, 303);
  response.headers.set("Cache-Control", "no-store");
  for (const { name, value, options: cookieOptions } of pendingCookies) {
    response.cookies.set(name, value, {
      ...cookieOptions,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: isProduction,
      // Verifier only needs to survive the provider round-trip.
      maxAge: name.endsWith("-code-verifier") ? 60 * 10 : cookieOptions.maxAge,
    } as Parameters<typeof response.cookies.set>[2]);
  }
  return response;
}
