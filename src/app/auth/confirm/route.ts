import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSupabasePublicConfig } from "@/utils/supabase/env";

function withSecureCookieDefaults(
  options: import("@supabase/ssr").CookieOptions = {},
) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    ...options,
    sameSite: options.sameSite ?? ("lax" as const),
    ...(isProduction ? { secure: true } : {}),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=invalid_confirm_link`);
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

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "email" | "signup" | "recovery" | "email_change",
  });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
