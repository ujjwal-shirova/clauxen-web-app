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
# Onboard clauxen.com (or your domain) under Cloudflare Email Service → Email Sending
npx wrangler deploy
```

Then set on Vercel:

```
AUTH_EMAIL_WORKER_URL=https://clauxen-auth-email.<subdomain>.workers.dev
AUTH_EMAIL_INTERNAL_TOKEN=<same secret>
```

## Domain

1. Cloudflare Dashboard → Email Service → Email Sending → Onboard Domain
2. Add SPF/DKIM DNS records Cloudflare proposes
3. Align `FROM_EMAIL` in `wrangler.toml` with an allowed sender on that domain
