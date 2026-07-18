/**
 * Path prefixes / exact paths that must stay reachable without login.
 * Used by Edge middleware (`src/utils/supabase/middleware.ts`).
 *
 * Keep chat app routes (/ , /new, /c/*, /library, …) protected.
 * Marketing pricing is `/plans` — not `/pricing` (in-app overlay).
 */

/** Exact public paths (no trailing slash). */
export const MARKETING_PUBLIC_EXACT = [
  "/overview",
  "/plans",
  "/download",
  "/features",
  "/work",
  "/codex",
  "/canvas",
  "/atlas",
  "/team",
  "/enterprise",
  "/business",
  "/college-students",
  "/contact-sales",
  "/customers",
  "/community",
  "/connectors",
  "/plugins",
  "/skills",
  "/docs",
  "/blog",
  "/ecosystem",
  "/fast-mode",
  "/partners",
  "/solutions",
  "/healthcare-administration",
  "/import-memory",
  "/problem-solvers",
  "/regional-compliance",
  "/office-hours",
  "/code-with-clauxen",
  "/custom-gpts",
  "/100chats",
  "/100chats-project",
  "/clauxen-for-chrome",
  "/clauxen-for-microsoft-365",
  "/marketplace-contact-sales",
  "/marketplace-partners",
  "/app-unavailable-in-region",
  "/unsubscribe",
] as const;

/**
 * Public path prefixes (pathname === prefix || pathname.startsWith(prefix + "/")).
 * Covers nested marketing pages under each section.
 */
export const MARKETING_PUBLIC_PREFIXES = [
  "/plans",
  "/features",
  "/codex",
  "/business",
  "/community",
  "/product",
  "/solutions",
  "/platform",
  "/programs",
  "/resources",
  "/partners",
  "/lp",
  "/form",
  "/blog-category",
  "/blog-product",
  "/blog-usecases",
  "/newsletter",
  "/blog",
  "/docs",
] as const;

export function isMarketingPublicPath(pathname: string): boolean {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  if ((MARKETING_PUBLIC_EXACT as readonly string[]).includes(path)) {
    return true;
  }

  return MARKETING_PUBLIC_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
