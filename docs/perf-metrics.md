# Clauxen performance metrics gates

Track these after each deploy. Ownership matches `docs/perf-architecture.md`.

## Vercel (Speed Insights + Observability Plus)

| Metric | Target | Where |
|--------|--------|--------|
| LCP / INP on `/new`, `/c/[id]` | Competitive with ChatGPT/Claude | Speed Insights |
| Generate function p95 duration (TTFT to first byte) | Trend down after Fluid + DO | Observability → Functions |
| Runtime Cache hit rate (`settings:*`) | >60% for repeat settings GET | Observability → Runtime Cache |
| Edge Config read errors | ~0 | Function logs `[edge-config]` |

Enable **Observability Plus** on the Pro team for longer retention and ISR/function insights.

## Cloudflare

| Metric | Target | Where |
|--------|--------|--------|
| `x-clauxen-cache` HIT rate on message pages | High after warm | Worker logs / response headers |
| chat-history Worker CPU time p95 | Low on HIT path | Workers Analytics |
| chat-coord `/lease` 409 rate | Low (only true concurrent gens) | Worker logs |
| Argo / HTTP/3 | Enabled on zone | Zone Speed dashboard |
| Hyperdrive | `caching.disabled: true` | `wrangler hyperdrive get` |

## Supabase

| Metric | Target | Where |
|--------|--------|--------|
| Pooler connections vs limit | Headroom with Dedicated Pooler | Reports / metrics |
| `fetch_chat_messages_page` / hot RPC p95 | Stable after indexes | `pg_stat_statements` + advisors |
| `gc_stale_streaming_messages` cron | Runs every 5m | `cron.job` |
| pgmq queue depth | Near-zero backlog | `pgmq.metrics` |

## Smoke checks

```bash
curl -sS https://clauxen-chat-history.ujjwal-8fc.workers.dev/health
curl -sS https://clauxen-chat-coord.ujjwal-8fc.workers.dev/health
npx wrangler hyperdrive get 54df64d31cce4e6f8f34415c6fb4e849
```
