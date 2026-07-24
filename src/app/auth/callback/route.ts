import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSupabasePublicConfig } from "@/utils/supabase/env";
import {
  DISPOSABLE_EMAIL_MESSAGE,
  isDisposableEmailSafe,
} from "@/server/email-verifier/disposable-email";

function withSecureCookieDefaults(options: CookieOptions = {}): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    ...options,
    sameSite: options.sameSite ?? "lax",
    ...(isProduction ? { secure: true } : {}),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/new";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const { url, publishableKey } = requireSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, withSecureCookieDefaults(options));
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email && isDisposableEmailSafe(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(DISPOSABLE_EMAIL_MESSAGE)}`,
    );
  }

  const safeNext =
    next.startsWith("/") && !next.startsWith("//")
      ? next === "/"
        ? "/new"
        : next
      : "/new";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
