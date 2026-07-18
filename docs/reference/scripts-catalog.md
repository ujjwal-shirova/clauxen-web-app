# Scripts Catalog

Notable scripts under `scripts/`.

## Root scripts

- `.DS_Store`
- `audit-public-env.mjs`
- `bootstrap-db-env.mjs`
- `cleanup-vercel-env.mjs`
- `deploy-cloudflare-workers.sh`
- `disable-vercel-attack-mode.mjs`
- `enable-x-auth.mjs`
- `list-domain-pages.mjs`
- `reconcile-vercel-env.mjs`
- `sync-vercel-env-api.mjs`
- `sync-vercel-env.mjs`
- `wire-auth-email-vercel.sh`
- `wire-chat-coord-vercel.sh`
- `wire-chat-history-vercel.sh`
- `worker.ts`

## `scripts/ops/`

- `ops/apply-cloudflare-perf-stack.sh`
- `ops/smoke-perf-stack.sh`

## Purpose notes

| Script | Purpose |
|---|---|
| `deploy-cloudflare-workers.sh` | Deploy all Workers |
| `ops/apply-cloudflare-perf-stack.sh` | Hyperdrive + Worker perf apply |
| `ops/smoke-perf-stack.sh` | Smoke checks |
| `reconcile-vercel-env.mjs` | Enforce sensitive/encrypted env shape |
| `sync-vercel-env*.mjs` | Sync env to Vercel |
| `cleanup-vercel-env.mjs` | Cleanup env rows |
| `wire-*-vercel.sh` | Wire Worker URLs/tokens to Vercel |
| `enable-x-auth.mjs` | Enable X OAuth in Supabase |
| `bootstrap-db-env.mjs` | Build-time DB env bootstrap |
| `worker.ts` | BullMQ project ingestion worker |
| `audit-public-env.mjs` | Detect leaked NEXT_PUBLIC secrets |
| `seed-blocked-email-domains.ts` | Seed blocked emails |
| `list-domain-pages.mjs` | List domain pages helper |
| `disable-vercel-attack-mode.mjs` | Disable attack mode |
| `website/generate-pages-manifest.py` | Pages manifest |

Package.json exposes: `worker`, `vercel:env:sync`, `audit:public-env`, supabase helpers.

## Related

- [`../ops/operations-runbook.md`](../ops/operations-runbook.md)
