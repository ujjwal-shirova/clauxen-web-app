import type { NextRequest } from "next/server";

/**
 * Cloudflare Managed Challenge often finishes by POSTing back to the same URL.
 * App Router document pages only accept GET, so Vercel answers with HTTP 405
 * ("This page isn't working") after a successful captcha.
 *
 * Normalize those challenge completions to GET via 303 — without weakening
 * Cloudflare security rules. Real API routes and Next.js Server Actions are
 * left untouched.
 */
export function isCloudflareChallengeDocumentPost(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method !== "POST" && method !== "PUT") return false;

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) return false;

  // Next.js Server Actions / Flight POSTs must keep their method.
  if (
    request.headers.has("next-action") ||
    request.headers.has("Next-Action") ||
    request.headers.has("rsc") ||
    request.headers.get("content-type")?.includes("text/x-component")
  ) {
    return false;
  }

  // Static / asset paths should never be challenge targets, but be safe.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return false;
  }

  return true;
}
