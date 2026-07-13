/**
 * Cloudflare zone + Worker performance checklist for Clauxen.
 * Apply in the Cloudflare dashboard (or Terraform) when the apex/www zone
 * proxies Vercel. This file is the source of truth for ops — not runtime code.
 *
 * Zone Speed features (dashboard → Speed → Optimization):
 * - HTTP/3 + 0-RTT: on
 * - Early Hints: on (Link preload for fonts / critical CSS)
 * - Brotli: on
 * - Rocket Loader: OFF (breaks React hydration)
 * - Auto Minify: OFF for JS (Next already ships minified; minify can break)
 * - Polish (lossy) + WebP: on for proxied images
 * - Mirage: optional on mobile; prefer next/image + R2 CDN
 *
 * Caching:
 * - Tiered Cache: Smart / Generic Global
 * - Cache Rules: cache everything under `/_next/static/*` (edge TTL 1y, browser 1y)
 * - Cache Rules: `/assets/*` edge TTL 1d + SWR 7d
 * - Bypass cache for `/api/*`, `/c/*`, `/new`, authenticated HTML shells
 *
 * Workers already in repo:
 * - `workers/chat-history` — Cache API → KV → R2 → Hyperdrive (chat messages)
 * - `workers/r2-gateway` — JWT upload/download + Cache API for GET downloads
 *
 * After TTL/header changes: `cd workers/chat-history && npx wrangler deploy`
 */
export const CLOUDFLARE_PERF_PROFILE = {
  earlyHints: true,
  http3: true,
  brotli: true,
  rocketLoader: false,
  autoMinifyJs: false,
  polish: "lossy",
  tieredCache: "smart",
  staticPathEdgeTtlSeconds: 31_536_000,
  assetsPathEdgeTtlSeconds: 86_400,
  chatHistoryLatestTtlSeconds: 900,
  chatHistoryCursorTtlSeconds: 300,
} as const;
