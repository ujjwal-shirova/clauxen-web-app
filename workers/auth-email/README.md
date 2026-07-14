# Clauxen auth-email Worker

Sends 6-digit signup verification codes via Cloudflare Email Service and stores hashed OTPs in KV.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/otp/send` | Generate + email OTP |
| POST | `/v1/otp/verify` | Verify OTP → one-time `signupTicket` |
| POST | `/v1/otp/consume-ticket` | Burn ticket after account create |
| GET | `/health` | Binding health |

All mutating routes require `Authorization: Bearer <AUTH_EMAIL_INTERNAL_TOKEN>` (or `x-clauxen-internal`).

## Deploy

```bash
cd workers/auth-email
npm install
npx wrangler secret put AUTH_EMAIL_INTERNAL_TOKEN
# Onboard clauxen.com under Cloudflare Email Service → Email Sending
# Sender must be allowed: no-reply@clauxen.com
npx wrangler deploy
```

Or from repo root (accepts Cursor secrets `Cloudflare_Token` / `Vercel_Token`):

```bash
./scripts/deploy-cloudflare-workers.sh
```

Then set on Vercel (auto if `Vercel_Token` is set):

```
AUTH_EMAIL_WORKER_URL=https://clauxen-auth-email.ujjwal-8fc.workers.dev
AUTH_EMAIL_INTERNAL_TOKEN=<same secret>
```

## Domain

1. Cloudflare Dashboard → Email Service → Email Sending → Onboard Domain (`clauxen.com`)
2. Add SPF/DKIM DNS records Cloudflare proposes
3. Allow sender `no-reply@clauxen.com` (matches `FROM_EMAIL` in `wrangler.toml`)
