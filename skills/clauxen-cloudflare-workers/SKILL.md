---
name: clauxen-cloudflare-workers
description: >-
  Clauxen Cloudflare Workers: chat-history, r2-gateway, chat-coord Durable Object, auth-email, zone cache/WAF. Use when deploying Workers, tuning Hyperdrive/KV/Cache API, fixing hydrate cache, uploads via WORKER_URL, generation leases, OTP email, or Cloudflare zone rules.
---

# Clauxen Cloudflare Workers

## Read first

- `docs/systems/cloudflare-workers.md`
- `docs/ops/cloudflare-zone-hardening.md`
- Per-worker README under `workers/*/README.md`

## Four workers

| Worker | Job |
|--------|-----|
| `clauxen-chat-history` | List/messages: Cache API → KV → R2 → Hyperdrive |
| `clauxen-r2-gateway` | Auth-gated R2 PUT/GET (`WORKER_URL`) |
| `clauxen-chat-coord` | Per-chat generation lease DO |
| `clauxen-auth-email` | OTP + magic via Email Sending |

## Deploy

```bash
./scripts/deploy-cloudflare-workers.sh
./scripts/ops/apply-cloudflare-perf-stack.sh   # needs valid CLOUDFLARE_API_TOKEN
./scripts/wire-chat-history-vercel.sh
./scripts/wire-chat-coord-vercel.sh
./scripts/wire-auth-email-vercel.sh
```

## Hard rules

1. Hyperdrive is **miss-only** for history (follow current caching-disabled policy).
2. Production uploads need `WORKER_URL`.
3. Worker PUTs: `Authorization: Bearer <supabase access token>` when `worker: true`.
4. Invalidate + warm after chat writes.
5. Free zone: 5 custom rules max; no `cf.threat_score`; skip Argo unless asked.
6. CF Managed Challenge POST→GET handled in `src/proxy.ts` — do not weaken CF rules.
7. Account deploy token may lack Zone Cache Rules edit (403) — use zone-edit token/dashboard.

## Additional resources

- [reference.md](reference.md)
