---
name: clauxen-auth
description: >-
  Clauxen authentication: Supabase GoTrue, unified login, OTP/magic via auth-email Worker, OAuth (including X provider x), sessions, proxy/middleware, onboarding gate. Use when working on login, signup, OTP, magic link, OAuth, session boot, AUTH_DEV_BYPASS, or auth.clauxen.com.
---

# Clauxen auth

## Read first

- `docs/systems/authentication.md`
- `docs/auth-migration.md`
- `workers/auth-email/README.md`

## Session resolution order

1. API key `Bearer clx_…`
2. Supabase JWT
3. Dev cookie `clauxen_session` only if `AUTH_DEV_BYPASS=true`

Production: `AUTH_DEV_BYPASS=false` → `/api/v1/auth/login|register` return **503**.

## Unified login

Continue with Email → existence check → password **or** create + OTP (Worker).  
`/signup` → `/login`. Magic link (new users) → `/auth/magic` (TTL 300s).

## Critical env

`AUTH_EMAIL_WORKER_URL`, `AUTH_EMAIL_INTERNAL_TOKEN`, Supabase public + service role, `JWT_SECRET`.

## Hard rules

1. KV OTP TTL **≥ 60s**.
2. Rotate Worker token **and** all Vercel targets together (prod/preview sensitive, development encrypted).
3. X OAuth callback: `https://auth.clauxen.com/auth/v1/callback` — never `*.supabase.co`. Provider id: **`x`**.
4. Client boot: `GET /api/v1/auth/session?quiet=1` then background full sync.
5. `src/proxy.ts`: skip `/api/*` session refresh; CF challenge POST→GET **303**.
6. Use `.auth-text-link` for auth text links.

## Key paths

- `src/server/auth/*`
- `src/server/services/auth-email-otp.service.ts`
- `src/app/login/page.tsx`, `src/app/auth/*`
- `src/contexts/auth-context.tsx`
- `workers/auth-email/`

## Additional resources

- [reference.md](reference.md)
