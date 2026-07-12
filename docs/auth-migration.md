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

1. Enable providers: Google, GitHub, Apple, GitLab, **X / Twitter (OAuth 2.0)**
2. Redirect URLs:
   - `{NEXT_PUBLIC_APP_URL}/auth/callback`
   - `http://localhost:9002/auth/callback` (local)
3. Site URL: `{NEXT_PUBLIC_APP_URL}`

## X / Twitter (OAuth 2.0)

App code uses Supabase provider `x` (not legacy `twitter` OAuth 1.0a).

1. Create an app at [developer.x.com](https://developer.x.com/en/portal/dashboard).
2. User authentication settings:
   - Type of App: **Web App**
   - Turn **ON** “Request email from users”
   - Callback URL: `https://ntplcfsbcyhiqklkbldk.supabase.co/auth/v1/callback`
   - Website URL: production app URL (and localhost for dev)
   - Terms / Privacy: `https://<app>/legal/terms` and `https://<app>/legal/privacy`
3. Copy **Client ID** + **Client Secret** (OAuth 2.0 section under Keys and tokens).
4. Enable in Supabase:
   - Dashboard → Authentication → Sign In / Providers → **X / Twitter (OAuth 2.0)**, or
   - `X_CLIENT_ID=… X_CLIENT_SECRET=… SUPABASE_ACCESS_TOKEN=… node scripts/enable-x-auth.mjs`
5. Login UI already calls `signInWithOAuth({ provider: "x" })` via Continue with X.

## Instagram OAuth

Skipped for v1 — not a built-in Supabase provider.
