/**
 * Cloudflare zone + Worker performance checklist for Clauxen.
 * Apply in the Cloudflare dashboard (or `scripts/ops/apply-cloudflare-perf-stack.sh`)
 * when the apex/www zone proxies Vercel. Source of truth for ops — not runtime code.
 *
 * ## Zone Speed (dashboard → Speed → Optimization)
 * - HTTP/3 + 0-RTT: on
 * - Early Hints: on
 * - Brotli: on
 * - Rocket Loader: OFF (breaks React hydration)
 * - Auto Minify JS: OFF
 * - Polish (lossy) + WebP: on
 * - Tiered Cache: Smart
 *
 * ## Cache Rules
 * - `/_next/static/*` — Edge TTL 1y, Browser 1y, cache everything
 * - `/assets/*` — Edge TTL 1d + SWR 7d
 * - Bypass: `/api/*`, `/login`, `/onboarding`, `/auth/*`, HTML shells (`/`, `/new`, `/c/*`, `/library`, `/projects`)
 * - Hash overlays (`#settings`) are client-only — never affect CDN keys
 *
 * ## Hyperdrive
 * - Config id `54df64d31cce4e6f8f34415c6fb4e849` bound as `HYPERDRIVE`
 * - Target: `npx wrangler hyperdrive update <id> --max-age 300 --swr 60`
 * - Optional second config with `--caching-disabled` as `HYPERDRIVE_FRESH`
 * - Worker placement: `aws:us-west-1` (near Supabase)
 *
 * ## Workers ladder (chat-history)
 * Cache API → KV → R2 → Hyperdrive
 * Endpoints: `GET /v1/chats`, `GET /v1/chats/:id/messages`, `POST /internal/warm|invalidate`
 * JWT auth memoized 60s in Cache API
 *
 * ## Supabase (applied via MCP 2026-07-14)
 * - Revoked anon/authenticated EXECUTE on SECURITY DEFINER chat RPCs
 * - Added FK covering indexes + chats(user_id, updated_at) for sidebar
 * - Enable Auth leaked-password protection in dashboard
 *
 * ## Vercel
 * - `vercel.json` CDN/no-store headers for static vs API
 * - Env: `NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL`, `CHAT_HISTORY_WORKER_URL`,
 *   `CHAT_HISTORY_INTERNAL_TOKEN`, `WORKER_URL`, `AUTH_EMAIL_*`
 *
 * ## Deploy
 * ```bash
 * chmod +x scripts/ops/apply-cloudflare-perf-stack.sh
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
  staticPathEdgeTtlSeconds: 31_536_000,
  assetsPathEdgeTtlSeconds: 86_400,
  chatHistoryLatestTtlSeconds: 1800,
  chatHistoryCursorTtlSeconds: 300,
  chatListTtlSeconds: 120,
  jwtCacheTtlSeconds: 60,
  hyperdriveMaxAgeSeconds: 300,
  hyperdriveSwrSeconds: 60,
  overlayRouting: "hash",
} as const;
