# Production deployment checklist

## 1. Authenticate Vercel CLI

```bash
npx vercel@41.7.0 login
```

## 2. Sync environment variables

```bash
npm run vercel:env:sync
```

This reads `.env.local` and pushes encrypted vars to **production**, **preview**, and **development**. Production overrides:

| Variable | Value |
|---|---|
| `AUTH_DEV_BYPASS` | `false` |
| `AUTH_REQUIRED_FOR_CHAT` | `true` |
| `STORAGE_REQUIRE_R2` | `true` |

## 3. Verify no secrets in browser

```bash
npm run audit:public-env
```

Only these `NEXT_PUBLIC_*` keys may exist in client code:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
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
