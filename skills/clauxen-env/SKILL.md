---
name: clauxen-env
description: >-
  Clauxen environment variables and secrets: .env.example groups, Vercel sensitive vs encrypted, reconcile script, Provider_* naming, Worker URLs/tokens. Use when adding env vars, syncing Vercel, rotating secrets, or debugging missing config.
---

# Clauxen env & secrets

## Read first

- `docs/reference/environment-variables.md`
- `.env.example`
- Skill `clauxen-deploy-ops`

## Groups

App public · App server · Supabase · R2 · Workers · `Provider_*` · Tools · Billing · Redis/JWT · Edge Config

## Rules

1. Never `NEXT_PUBLIC_` for secrets.
2. Prod/Preview = sensitive; Development = encrypted duplicate.
3. Inference: `Provider_API_Key`, `Provider_BASE_URL`, `Provider_Model_Clauxen_V1`.
4. After reconcile, **verify** Provider keys still work.
5. `npm run audit:public-env` before shipping env changes.
6. Do not commit `.env.local` / `.env.vercel`.

## Scripts

`scripts/reconcile-vercel-env.mjs`, `sync-vercel-env*.mjs`, `wire-*-vercel.sh`

## Additional resources

- [reference.md](reference.md)
