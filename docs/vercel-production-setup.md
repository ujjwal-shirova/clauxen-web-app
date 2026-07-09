# Production deployment checklist

## 1. Sync environment variables

**Note:** The Cursor Vercel MCP plugin does not expose env-var management tools (only projects, deployments, logs). Use one of:

### Option A — Vercel Dashboard (recommended)

Project: **clauxen** (`shirova-ai` team) → Settings → Environment Variables

Copy all keys from `.env.local` / `.env.example`. Set production overrides:

| Variable | Production value |
|---|---|
| `AUTH_DEV_BYPASS` | `false` |
| `AUTH_REQUIRED_FOR_CHAT` | `true` |
| `STORAGE_REQUIRE_R2` | `true` |
| `NEXT_PUBLIC_APP_URL` | `https://clauxen.vercel.app` |

Mark secrets as **Sensitive**: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOVITA_AI_KEY`, `EXA_API_KEY`, `FAL_KEY`, `RAZORPAY_KEY_SECRET`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_API_TOKEN`, `JWT_SECRET`.

### Option B — REST API scripts (needs fresh token)

```bash
# Create token at https://vercel.com/account/tokens
export VERCEL_TOKEN=your_token

# First-time or messy state: reconcile (restores Supabase integration vars, marks sensitive)
node scripts/reconcile-vercel-env.mjs

# Ongoing sync from .env.local (app keys only — never overwrites Supabase user-fill keys)
node scripts/sync-vercel-env-api.mjs
```

`reconcile-vercel-env.mjs` sets exactly **33 keys**, one row each (`production`, `preview`, `development` shared). Supabase/Postgres keys are left **blank** for you to fill in the Vercel dashboard.

### Option C — Monitor via Vercel MCP

Use MCP to verify deployments after env is configured:

- `get_project` — latest deployment status
- `list_deployments` — history
- `get_deployment_build_logs` — build failures

## 2. Verify no secrets in browser

```bash
npm run audit:public-env
```

Only these `NEXT_PUBLIC_*` keys may exist in client code:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not a separate publishable key)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` (public checkout key — **not** the secret)
- `NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT`
- `NEXT_PUBLIC_CHECKOUT_USD_INR_RATE`

**Never** prefix secrets with `NEXT_PUBLIC_`. Server-only keys (Novita, Exa, Fal, R2, DB, service role, webhooks) stay without the prefix and are only read in `src/backend/` or API routes.

## 4. Supabase production

- Redirect URLs: `{APP_URL}/auth/callback`, `{APP_URL}/auth/confirm`
- Run migration: `npx supabase db push`

## 5. Deploy

```bash
npx vercel@41.7.0 --prod
```

## Security model

| Layer | Protection |
|---|---|
| Vercel env | Encrypted at rest; injected server-side only for non-`NEXT_PUBLIC_` vars |
| Next.js | `NEXT_PUBLIC_*` inlined at build — only allowlisted keys |
| API errors | Production responses hide SQL/stack traces (`api-response.ts`) |
| Headers | CSP, HSTS, nosniff (`next.config.ts`, `vercel.json`) |
| Auth | `AUTH_DEV_BYPASS=false` on Vercel by default (`env.ts`) |
