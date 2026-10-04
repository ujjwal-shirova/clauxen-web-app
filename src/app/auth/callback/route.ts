import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSupabasePublicConfig } from "@/utils/supabase/env";
import {
  DISPOSABLE_EMAIL_MESSAGE,
  isDisposableEmailSafe,
} from "@/server/email-verifier/disposable-email";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/new";

  const errorParam =
    searchParams.get("error_description") || searchParams.get("error");
  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/new?auth=1&error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/new?auth=1&error=missing_code`);
  }

  const safeNext =
    next.startsWith("/") && !next.startsWith("//")
      ? next === "/"
        ? "/new"
        : next
      : "/new";

  const redirectUrl = `${origin}${safeNext}`;
  const response = NextResponse.redirect(redirectUrl);

  const cookieStore = await cookies();
  const { url, publishableKey } = requireSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      `${origin}/new?auth=1&error=${encodeURIComponent(error.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email && isDisposableEmailSafe(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/new?auth=1&error=${encodeURIComponent(DISPOSABLE_EMAIL_MESSAGE)}`,
    );
  }

  return response;
}
