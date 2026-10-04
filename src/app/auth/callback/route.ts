import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabasePublicConfig } from "@/utils/supabase/env";
import {
  DISPOSABLE_EMAIL_MESSAGE,
  isDisposableEmailSafe,
} from "@/server/email-verifier/disposable-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/new";
  return raw === "/" ? "/new" : raw;
}

function gateError(origin: string, message: string) {
  const res = NextResponse.redirect(
    `${origin}/new?auth=1&error=${encodeURIComponent(message)}`,
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const otpType = params.get("type") as EmailOtpType | null;
  const next = safeNext(params.get("next"));

  const providerError = params.get("error_description") || params.get("error");
  if (providerError) return gateError(origin, providerError);
  if (!code && !(tokenHash && otpType)) {
    return gateError(origin, "Sign-in link is missing or expired. Try again.");
  }

  const isProduction = process.env.NODE_ENV === "production";
  const response = NextResponse.redirect(`${origin}${next}`);
  response.headers.set("Cache-Control", "no-store");

  const { url, publishableKey } = requireSupabasePublicConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            path: "/",
            sameSite: "lax",
            secure: isProduction,
          });
        });
      },
    },
  });

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: otpType! });

  if (error) {
    console.error("[auth/callback] session exchange failed:", error.message);
    return gateError(
      origin,
      error.code === "pkce_code_verifier_not_found"
        ? "Your sign-in session expired. Please try again."
        : error.message,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email && isDisposableEmailSafe(user.email)) {
    await supabase.auth.signOut();
    return gateError(origin, DISPOSABLE_EMAIL_MESSAGE);
  }

  return response;
}
