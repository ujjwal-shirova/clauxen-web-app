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
 * - Smart Tiered Cache: on with the Vercel public-cloud origin hint (free)
 * - Argo Smart Routing: OFF unless measured origin-path latency justifies it
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
 * - chat-history: Cache API → KV → R2 archives → Hyperdrive
 *   (read path for chat hydrate; never rate-limit subscribers)
 * - r2-gateway: JWT upload/download (sole product upload path)
 *   Bindings: IMAGES, DOCUMENTS, ARTIFACTS, USER_FILES, ATTACHMENTS
 *   ATTACHMENTS → `clauxen-user-attachments` (composer / edit uploads)
 *   Object keys: `users/{userId}/attachments/{yyyy}/{mm}/{chatId|draft}/{uuid}-{file}`
 * - auth-email: OTP / magic link
 * - chat-coord: Durable Object generation lease per chatId
 *
 * ## Supabase
 * - Transaction pooler :6543; scale the pool only after connection saturation
 * - SECURITY DEFINER chat RPCs service_role-only
 * - pgvector for RAG; no Vectorize on product path
 *
 * ## Vercel
 * - Region `pdx1` (near Supabase us-west-1)
 * - Fluid Compute on; keep 1 GB only for long-running streaming/generation routes
 * - Env: CHAT_HISTORY_WORKER_URL + WORKER_URL + CHAT_COORD_* + EDGE_CONFIG
 * - Env: R2_ATTACHMENTS_BUCKET=clauxen-user-attachments
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
  // Argo is a paid add-on. The free-zone default is the better cost/perf
  // baseline until monitoring shows origin-network latency is the bottleneck.
  argoSmartRouting: false,
  workerTraceSampling: {
    chatHistory: 0.05,
    chatCoord: 0.1,
    r2Gateway: 0.1,
  },
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
