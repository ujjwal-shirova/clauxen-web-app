import type { NextRequest } from "next/server";
import {
  getClaimsFromCookies,
  verifyAccessToken,
  type SupabaseJwtClaims,
} from "@/server/auth/jwt";

/**
 * Resolve Supabase identity for an incoming request with zero network calls.
 *
 * Order: `Authorization: Bearer <supabase-jwt>` (Workers / native clients),
 * then the `sb-<ref>-auth-token` cookie written by @supabase/ssr.
 */
export async function getSupabaseClaimsFromRequest(
  request: NextRequest,
): Promise<SupabaseJwtClaims | null> {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    // Supabase access tokens are JWTs (three dot-separated segments). Other
    // bearer formats (API keys, OAuth tokens) are handled by session.ts.
    if (token.split(".").length === 3) {
      const claims = await verifyAccessToken(token);
      if (claims) return claims;
    }
  }
  return getClaimsFromCookies(request.cookies);
}

export async function getSupabaseUserIdFromRequest(
  request: NextRequest,
): Promise<string | null> {
  return (await getSupabaseClaimsFromRequest(request))?.sub ?? null;
}
