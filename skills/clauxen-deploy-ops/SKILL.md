---
name: clauxen-deploy-ops
description: >-
  Clauxen deploy and operations: Vercel verified commits, env reconcile (sensitive/encrypted), Worker deploys, incident runbook, region pdx1. Use when deploying, rotating secrets, fixing canceled deploys, env sync, or production incidents.
---

# Clauxen deploy & ops

## Read first

- `docs/ops/operations-runbook.md`
- `docs/vercel-deployment.md`
- `docs/reference/environment-variables.md`

## App deploy

Verified **SSH-signed** commits required (signing key on GitHub ≠ auth-only key).  
Region `pdx1`. `vercel.json` sets function memory/timeouts.

## Env shape

| Target | Type |
|--------|------|
| Production / Preview | **sensitive** |
| Development | **encrypted** (API forbids sensitive) |

```bash
node scripts/reconcile-vercel-env.mjs
```

**Danger:** reconcile can overwrite working `Provider_*` with bad local values — verify after.  
`FORCE_OVERWRITE_SENSITIVE=1` only for intentional rotation.

## Workers

See skill `clauxen-cloudflare-workers`.

## Incident quick hits

| Symptom | First checks |
|---------|----------------|
| Blank assistants | SSE error propagation, dedupe, Realtime mute |
| 409 generate | chat-coord lease / stop |
| Upload fail | `WORKER_URL`, JWT on PUT |
| OTP missing | Email Sending, KV TTL≥60, token match |
| Deploy canceled | commit not Verified |
| Auth page 405 | proxy CF challenge POST→GET |

## Additional resources

- [reference.md](reference.md)
- `docs/reference/scripts-catalog.md`
