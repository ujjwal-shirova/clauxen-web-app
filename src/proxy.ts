import { type NextRequest, NextResponse } from "next/server";
import { isCloudflareChallengeDocumentPost } from "@/lib/cloudflare-challenge-post";
import { updateSession } from "@/utils/supabase/middleware";
import { getSupabasePublicConfig } from "@/utils/supabase/env";

export async function proxy(request: NextRequest) {
  // After Cloudflare Managed Challenge, the browser may POST to a document URL
  // that only supports GET → Vercel 405. Convert to GET without changing CF rules.
  if (isCloudflareChallengeDocumentPost(request)) {
    const url = request.nextUrl.clone();
    return NextResponse.redirect(url, 303);
  }

  const pathname = request.nextUrl.pathname;

  // If Supabase falls back to the Site URL (redirect URL not allow-listed),
  // the OAuth `code` lands on `/` or `/new`. Forward it to the callback so
  // the session is still exchanged server-side instead of erroring.
  if (
    !pathname.startsWith("/auth/") &&
    !pathname.startsWith("/api/") &&
    request.nextUrl.searchParams.has("code") &&
    (pathname === "/" || pathname === "/new" || pathname === "/login")
  ) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }

  // API handlers and auth callback/confirm/magic routes handle themselves.
  // Skipping edge session update here prevents middleware from wiping PKCE code verifier
  // cookies before exchangeCodeForSession runs.
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return NextResponse.next({ request });
  }

  const supabase = getSupabasePublicConfig();
  if (supabase.url && supabase.publishableKey) {
    return updateSession(request);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
