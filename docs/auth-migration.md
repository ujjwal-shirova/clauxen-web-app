# Auth migration — dev cookie to Supabase GoTrue

## Production (`AUTH_DEV_BYPASS=false`)

- User login: Supabase GoTrue only (email/password, magic link, OAuth)
- Routes: `/login`, `/signup`, `/auth/callback`, `/auth/confirm`
- Session resolution: `getSessionFromRequest` reads Supabase JWT cookies first
- Dev endpoints disabled:
  - `POST /api/v1/auth/login` → `503 auth_unavailable`
  - `POST /api/v1/auth/register` → `503 auth_unavailable`

## Local development (`AUTH_DEV_BYPASS=true`, default)

- Fast path: `POST /api/v1/auth/login` sets `clauxen_session` cookie (auto-register)
- Supabase sessions also work when configured
- Order: API key → Supabase → dev cookie

## Supabase Dashboard setup

1. Enable providers: Google, GitHub, Facebook, Twitter (X)
2. Redirect URLs:
   - `{NEXT_PUBLIC_APP_URL}/auth/callback`
   - `http://localhost:9002/auth/callback` (local)
3. Site URL: `{NEXT_PUBLIC_APP_URL}`

## Instagram OAuth

Skipped for v1 — not a built-in Supabase provider.
