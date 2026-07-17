/**
 * Cloudflare zone + Worker performance checklist for Clauxen.
 * Apply in the Cloudflare dashboard (or `scripts/ops/apply-cloudflare-perf-stack.sh`)
 * when the apex/www zone proxies Vercel. Source of truth for ops — not runtime code.
 * Full ownership matrix: `docs/perf-architecture.md`.
 *
 * ## Zone Speed (dashboard → Speed → Optimization)
 * - HTTP/3 + 0-RTT: on
 * - Early Hints: on
 * - Brotli: on
 * - Rocket Loader: OFF (breaks React hydration)
 * - Auto Minify JS: OFF
 * - Polish (lossy) + WebP: on
 * - Tiered Cache: Smart
 * - Argo Smart Routing: ON (paid — origin path to Vercel + Workers)
 *
 * ## Cache Rules
 * - `/_next/static/*` — Edge TTL 1y, Browser 1y, cache everything
 * - `/assets/*` — Edge TTL 1d + SWR 7d
 * - Bypass: `/api/*`, `/login`, `/onboarding`, `/auth/*`, HTML shells (`/`, `/new`, `/c/*`, `/library`, `/projects`)
 * - Hash overlays (`#settings`) are client-only — never affect CDN keys
 *
 * ## Hyperdrive
 * - Config id `54df64d31cce4e6f8f34415c6fb4e849` bound as `HYPERDRIVE`
 * - Chat-history must stay `--caching-disabled` (read-after-write)
 * - Worker placement: `aws:us-west-1` (near Supabase)
 *
 * ## Workers
 * - chat-history: Cache API → KV → R2 → Hyperdrive
 * - r2-gateway: JWT upload/download (sole product upload path)
 * - auth-email: OTP / magic link
 * - chat-coord: Durable Object generation lease per chatId
 *
 * ## Supabase
 * - Transaction pooler :6543 + Dedicated Pooler addon
 * - SECURITY DEFINER chat RPCs service_role-only
 * - pgvector for RAG; no Vectorize on product path
 *
 * ## Vercel
 * - Region `pdx1` (near Supabase us-west-1)
 * - Fluid Compute + Performance CPU on generate
 * - Env: chat-history + WORKER_URL + CHAT_COORD_* + EDGE_CONFIG
 *
 * ## Deploy
 * ```bash
 * ./scripts/ops/apply-cloudflare-perf-stack.sh
 * ```
 */
export const CLOUDFLARE_PERF_PROFILE = {
  earlyHints: true,
  http3: true,
  brotli: true,
  rocketLoader: false,
  autoMinifyJs: false,
  polish: "lossy",
  tieredCache: "smart",
  argoSmartRouting: true,
  staticPathEdgeTtlSeconds: 31_536_000,
  assetsPathEdgeTtlSeconds: 86_400,
  chatHistoryLatestTtlSeconds: 120,
  chatHistoryCursorTtlSeconds: 120,
  chatListTtlSeconds: 60,
  jwtCacheTtlSeconds: 60,
  hyperdriveCachingDisabled: true,
  overlayRouting: "hash",
  vercelRegion: "pdx1",
} as const;
