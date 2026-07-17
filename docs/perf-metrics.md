# Clauxen performance verification (no Speed Insights / Observability Plus)

Self-verify after deploys with CLI + Playwright. Ownership: `docs/perf-architecture.md`.

## Smoke checks (required)

```bash
curl -sS https://clauxen-chat-history.ujjwal-8fc.workers.dev/health
curl -sS https://clauxen-chat-coord.ujjwal-8fc.workers.dev/health
npx wrangler hyperdrive get 54df64d31cce4e6f8f34415c6fb4e849   # caching.disabled=true
./scripts/ops/smoke-perf-stack.sh
```

## Cloudflare

| Check | How |
|-------|-----|
| HTTP/3, Early Hints, Tiered Cache (Smart) | Dashboard Speed / Caching (Argo skipped) |
| Hyperdrive fresh | `caching.disabled: true` |
| Worker health | `/health` on history + coord + r2-gateway |
| Cache HIT | Response header `x-clauxen-cache` on history pages |

## Supabase

| Check | How |
|-------|-----|
| Transaction pooler `:6543` | Vercel `POSTGRES_URL` / app pool (skip paid Dedicated Pooler unless requested) |
| GC cron | `select * from cron.job where jobname like 'clauxen%'` |
| pgmq queues | `select * from pgmq.list_queues()` |

## Playwright product path

Use Playwright CLI against production (auth may be required for `/new`):

1. Open `https://www.clauxen.com` — pass Cloudflare challenge if shown.
2. Confirm static `/_next/static/*` responses are cacheable (CF/Vercel CDN).
3. Confirm Workers health via smoke script above (lease conflict = DO up).
