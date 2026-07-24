# Authentication

## 1. Overview

Clauxen uses **Supabase GoTrue** as the production identity provider, with:

- Email/password (unified login entry)
- OTP signup via Cloudflare `clauxen-auth-email` Worker
- Magic link signup (new users) → `/auth/magic`
- OAuth (Google, GitHub, GitLab, Apple, X/Twitter OAuth 2.0 provider `x`)
- Custom auth domain: **`https://auth.clauxen.com`**
- Dev cookie bypass when `AUTH_DEV_BYPASS=true`

Session resolution order in API handlers (`getSessionFromRequest` / auth stack):

1. API key `Authorization: Bearer clx_…`
2. Supabase JWT cookies / bearer
3. Dev cookie `clauxen_session` (only if bypass enabled)

---

## 2. Key files

| File | Role |
|---|---|
| `src/server/auth/session.ts` | Session types / cookie helpers |
| `src/server/auth/supabase-session.ts` | Supabase JWT extraction |
| `src/server/auth/require-session.ts` | Guard for authenticated routes |
| `src/server/services/auth-credentials.service.ts` | Password/credential flows |
| `src/server/services/auth-email-otp.service.ts` | Talks to auth-email Worker |
| `src/server/services/identity.service.ts` | Profile/workspace bootstrap |
| `src/utils/supabase/middleware.ts` | `updateSession` for document routes |
| `src/proxy.ts` | Skips `/api/*` session refresh; CF challenge POST→GET |
| `src/app/login/page.tsx` | Unified login UI |
| `src/app/auth/callback/route.ts` | OAuth PKCE exchange |
| `src/app/auth/confirm/route.ts` | Email confirm / recovery |
| `src/app/auth/magic/page.tsx` | Magic link set-password |
| `src/app/auth/reset-password/page.tsx` | Password reset UI |
| `src/contexts/auth-context.tsx` | Client session boot |
| `workers/auth-email/` | OTP + magic link Worker |

---

## 3. Production vs development

### Production (`AUTH_DEV_BYPASS=false`, auto-default when `VERCEL=1`)

- GoTrue only
- `POST /api/v1/auth/login` and `/register` return **503 `auth_unavailable`**
- Unified email flow uses signup OTP / magic / password against Supabase + Worker

### Development (`AUTH_DEV_BYPASS=true`)

- Fast path: `POST /api/v1/auth/login` sets `clauxen_session` (auto-register)
- Supabase sessions still work when configured
- `AUTH_DEV_BYPASS` can also simulate OTP locally for Worker-less testing

Migration notes: [`../auth-migration.md`](../auth-migration.md).

---

## 4. Unified login (Continue with Email)

Leonardo-style single entry (no separate signup surface):

1. User enters email → existence check (`/api/v1/auth/email-status` or equivalent validate path)
2. **Existing user** → password field → Supabase password sign-in
3. **New user** → create path:
   - Request OTP → Worker `POST /v1/otp/send`
   - User enters 6-digit code → verify → `signupTicket`
   - Complete registration consuming ticket
4. Alternative: magic link label for new users (TTL 300s)

`/signup` redirects to `/login`.

---

## 5. Auth-email Worker protocol

Worker: `AUTH_EMAIL_WORKER_URL`  
Auth: `Authorization: Bearer <AUTH_EMAIL_INTERNAL_TOKEN>` or `x-clauxen-internal`

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/otp/send` | Generate + email OTP (hashed in KV) |
| POST | `/v1/otp/verify` | Verify → one-time `signupTicket` |
| POST | `/v1/otp/consume-ticket` | Burn ticket after account create |
| POST | `/v1/magic/send` | Send magic link (signup) |
| POST | `/v1/magic/inspect` | Inspect token without consuming |
| POST | `/v1/magic/consume` | Consume magic token |
| GET | `/health` | Binding health |

Sender: `no-reply@clauxen.com` via Cloudflare Email Sending for `clauxen.com`.

**Gotcha:** Workers KV `expirationTtl` must be ≥ 60s (cooldown was 45 and crashed sends).

App routes:

- `POST /api/v1/auth/signup/request-otp`
- `POST /api/v1/auth/signup/verify`
- `POST /api/v1/auth/magic/request`
- `POST /api/v1/auth/magic/inspect`
- `POST /api/v1/auth/magic/complete`
- `POST /api/v1/auth/validate-email`

---

## 6. Magic link signup

1. New user requests magic link
2. Email contains 5-minute link → `/auth/magic`
3. Page inspects token, collects password
4. Complete → session + onboarding redirect
5. Existing-user magic login is deferred (not primary path yet)

---

## 7. OAuth

### Callback URLs

Supabase Auth URL configuration must include:

- `{NEXT_PUBLIC_APP_URL}/auth/callback`
- `{NEXT_PUBLIC_APP_URL}/auth/confirm`
- `http://localhost:9002/auth/callback` (local)

### X / Twitter (OAuth 2.0)

- Provider id: **`x`** (not legacy `twitter`)
- Callback must be `https://auth.clauxen.com/auth/v1/callback` — never `*.supabase.co`
- Website: `https://www.clauxen.com`
- Enable via Dashboard or `scripts/enable-x-auth.mjs`
- Request email from users ON

### Instagram

Skipped for v1 — not a built-in Supabase provider.

---

## 8. Session boot (client)

1. Quiet session fetch (`?quiet=1`) for FCP
2. Render shell
3. Background full sync (profile, workspace, onboarding flags)
4. Auth redirects via `auth-redirect.ts` helpers

`AUTH_REQUIRED_FOR_CHAT` / `NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT` gate chat APIs and UI prompts.

---

## 9. Proxy / middleware behavior

`src/proxy.ts`:

1. Cloudflare Managed Challenge may POST to document URLs → convert to **303 GET** (`isCloudflareChallengeDocumentPost`) to avoid Vercel 405. Do not weaken CF rules for this.
2. Paths under `/api/` skip `updateSession` — handlers auth themselves (cuts stacked TTFB on `/c` cold loads).
3. Other matched routes call `updateSession` when Supabase public config present.

Matcher excludes static assets.

---

## 10. Profile bootstrap

On new user (`handle_new_user` trigger / identity service):

- Create `profiles` row (display_name, preferred_name, avatar, …)
- Ensure personal workspace membership as designed
- Onboarding step state
- X OAuth metadata handling (`handle_new_user_x_oauth_metadata` migration)

Settings Profile maps:

| UI field | Storage |
|---|---|
| Full name | `profiles.display_name` |
| Nickname | `profiles.preferred_name` |
| Occupation | `user_settings.settings.personalization` |
| Custom instructions | same JSONB |

Custom instructions append to chat system prompt via `buildUserPersonalizationAppend` → `buildModelSystemPrompt({ append })`.

---

## 11. Security events & API keys

- Successful auth writes `user_security_events` where implemented
- Programmatic access: `api_keys` with `clx_…` bearer tokens
- Manage via `/api/v1/api-keys`

---

## 12. Onboarding gate

After first successful auth, users may be redirected to `/onboarding` until steps complete (`onboarding_answers`, profile fields). See [`onboarding.md`](./onboarding.md).

---

## 13. Env checklist

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin |
| `AUTH_DEV_BYPASS` | Dev cookie path |
| `AUTH_REQUIRED_FOR_CHAT` | Gate chat |
| `AUTH_EMAIL_WORKER_URL` | OTP Worker |
| `AUTH_EMAIL_INTERNAL_TOKEN` | Worker shared secret |
| `JWT_SECRET` | Project JWT / related signing |

Never put service role or internal tokens in `NEXT_PUBLIC_*`.

---

## 14. Operational gotchas

- Rotate `AUTH_EMAIL_INTERNAL_TOKEN` on Worker **and** all Vercel targets together
- Vercel sensitive env cannot target Development — use encrypted Development row with same value
- Enable Auth leaked-password protection in Supabase Dashboard
- Anon/authenticated EXECUTE revoked on chat SECURITY DEFINER RPCs — service_role/postgres only

---

## 15. Related

- [`../auth-migration.md`](../auth-migration.md)
- [`cloudflare-workers.md`](./cloudflare-workers.md)
- [`onboarding.md`](./onboarding.md)
- [`../ops/security.md`](../ops/security.md)
