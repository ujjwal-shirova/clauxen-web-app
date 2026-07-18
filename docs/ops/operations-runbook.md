# Operations Runbook

## 1. Deploy app (Vercel)

```bash
# verified commit on branch
git push
# Vercel auto-deploy; or:
vercel --prod
```

Region: `pdx1`. Build: `npm run build` / `vercel-build`.  
Function memory defaults 512; generate/agent/sandbox 1024 + 300s.

Require Verified Commits is ON.

---

## 2. Deploy Workers

```bash
export CLOUDFLARE_API_TOKEN=…   # valid token
./scripts/deploy-cloudflare-workers.sh
# or per worker:
cd workers/chat-history && npx wrangler deploy
cd workers/r2-gateway && npx wrangler deploy
cd workers/chat-coord && npx wrangler deploy
cd workers/auth-email && npx wrangler deploy
```

Wire env:

```bash
./scripts/wire-chat-history-vercel.sh
./scripts/wire-chat-coord-vercel.sh
./scripts/wire-auth-email-vercel.sh
```

Perf:

```bash
./scripts/ops/apply-cloudflare-perf-stack.sh
./scripts/ops/smoke-perf-stack.sh
```

---

## 3. Env reconcile

```bash
node scripts/reconcile-vercel-env.mjs
```

Shape: production+preview=sensitive, development=encrypted; all keys on all three targets.

**Danger:** reconcile can overwrite working Provider keys with invalid local values — verify after runs. Use `FORCE_OVERWRITE_SENSITIVE=1` only for intentional rotation.

---

## 4. Incidents

### Chat blank assistants

1. Check generate logs for provider 401/5xx
2. Confirm SSE errors propagate (parser must not swallow)
3. Check dedupe — empty snapshot winning?
4. Check Realtime mute

### 409 generation_in_progress

1. Stop endpoint
2. chat-coord `/status`
3. Release stuck lease if DO unhealthy → redeploy chat-coord

### Uploads failing

1. `WORKER_URL` set?
2. Worker auth JWT valid?
3. R2 bindings healthy (`/health`)

### OTP not arriving

1. Email Sending domain status
2. Worker logs
3. KV TTL ≥ 60
4. Token match Vercel ↔ Worker

### Auth 405 on pages

1. Confirm proxy CF challenge POST→GET still deployed
2. Do not disable Managed Challenge without replacement

### Slow `/c` hydrate

1. `x-clauxen-cache` header
2. Device cache warm?
3. Hyperdrive / pooler
4. Seed race / Worker URL

### Vercel deploy canceled

Unverified commit — fix signing key on GitHub.

---

## 5. Supabase

```bash
npm run supabase:db:push
npm run supabase:functions:deploy  # if any
```

Enable leaked-password protection in dashboard.  
Monitor advisors (security/performance) periodically.

---

## 6. Related scripts catalog

See [`../reference/scripts-catalog.md`](../reference/scripts-catalog.md).

---

## 7. Related

- [`security.md`](./security.md)
- [`../vercel-deployment.md`](../vercel-deployment.md)
- [`../systems/cloudflare-workers.md`](../systems/cloudflare-workers.md)
