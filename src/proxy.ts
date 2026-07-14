import { type NextRequest, NextResponse } from "next/server";
import { isCloudflareChallengeDocumentPost } from "@/frontend/lib/cloudflare-challenge-post";
import { updateSession } from "@/utils/supabase/middleware";
import { getSupabasePublicConfig } from "@/utils/supabase/env";

export async function proxy(request: NextRequest) {
  // After Cloudflare Managed Challenge, the browser may POST to a document URL
  // that only supports GET → Vercel 405. Convert to GET without changing CF rules.
  if (isCloudflareChallengeDocumentPost(request)) {
    const url = request.nextUrl.clone();
    return NextResponse.redirect(url, 303);
  }

  // API handlers authenticate themselves. Skipping edge getUser() here cuts
  // stacked TTFB on /c cold loads (document + session + messages + branches).
  if (request.nextUrl.pathname.startsWith("/api/")) {
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
