# Cloudflare Workers setup (one time, ~5 minutes)

All 7 workers (`auth-email`, `billing`, `chat-coord`, `chat-history`,
`connector-gateway`, `r2-gateway`, `scheduled-tasks`) deploy with one script.
Pick **one** auth option, then run it. You never need to hand-pick
permissions one by one.

## Option A — `wrangler login` (recommended, zero permission setup)

```sh
npx wrangler login
CONNECTOR_GATEWAY_INTERNAL_TOKEN="$(openssl rand -hex 32)" \
BILLING_INTERNAL_TOKEN="$(openssl rand -hex 32)" \
SCHEDULED_TASKS_INTERNAL_TOKEN="$(openssl rand -hex 32)" \
./scripts/deploy-cloudflare-workers.sh
```

OAuth grants Wrangler what it needs — no tokens, no permission screens. The
script prints the token values you must mirror on Vercel (same values both
sides) and saves them under `/tmp/clauxen-*.txt` (mode 600).

## Option B — API token (headless CI / agents)

1. Dashboard → **My Profile → API Tokens → Create Token**.
2. Under **Permission policies**, open the **Custom** dropdown and pick the
   **Edit Cloudflare Workers** template (one click — this is the whole list,
   do not add permissions individually).
3. Click **Add more** twice and add:
   - Account → **Queues** → Edit (chat-history, scheduled-tasks, gateway queues)
   - Account → **Hyperdrive** → Edit (chat-history, gateway Postgres)
4. Scope: Account → your account only. Zone resources are unused by this
   repo (no custom domains); leave them out.
5. Copy the token once, then:

```sh
export CLOUDFLARE_API_TOKEN="<token>"
export CLOUDFLARE_ACCOUNT_ID="8fc7a67e9057989309921f362784ecf4"
./scripts/deploy-cloudflare-workers.sh
```

Why only 2 additions: the template already covers Workers Scripts (deploys,
secrets, cron triggers, Durable Object migrations), KV, R2, Tail, and
account/user reads. There is no separate permission for Durable Objects,
`send_email` bindings, or rate-limit namespaces — all ride on Workers
Scripts. Always export `CLOUDFLARE_ACCOUNT_ID` explicitly: without it
Wrangler calls `/memberships` and fails on account-scoped tokens.

## Secrets cheat sheet

| Worker secret | Generate? | Also set on Vercel? |
|---|---|---|
| `CONNECTOR_ENCRYPTION_KEY` | Only for first-ever deploy: `openssl rand -base64 32`. **Never rotate casually — it bricks sealed OAuth tokens.** | No (Cloudflare only) |
| `CONNECTOR_GATEWAY_INTERNAL_TOKEN` | Yes (`openssl rand -hex 32`) | Yes, same value |
| `CONNECTOR_GATEWAY_ADMIN_TOKEN` | Script auto-generates | No |
| `BILLING_INTERNAL_TOKEN` | Yes | Yes, same value |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | No — paste from Razorpay | No |
| `*_INTERNAL_TOKEN` (other workers) | Script auto-generates | Yes, same values (script prints them) |

`wrangler deploy` preserves existing secrets, so re-running the script only
changes what you explicitly `secret put`. The script refuses to touch
`CONNECTOR_ENCRYPTION_KEY` unless you export it deliberately.

## Verify

```sh
npm run plugins:setup
curl -s https://clauxen-connector-gateway.ujjwal-8fc.workers.dev/health
```

Expect `result: OK (full mode)` and `{"status":"ok",...}`.
