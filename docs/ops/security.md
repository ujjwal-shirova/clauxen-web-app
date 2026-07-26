# Security

## 1. Threat model (summary)

| Asset | Protection |
|---|---|
| Provider API keys | Server-only Sensitive env; never browser |
| Supabase service role | Server-only |
| User sessions | GoTrue JWT httpOnly cookies; custom auth domain |
| Chat data | RLS + server repos; Worker JWT auth |
| Uploads | Bearer JWT on r2-gateway |
| Billing webhooks | Razorpay signature secret |
| Internal Workers | Shared internal tokens |
| Public auth/marketing HTML | CF Managed Challenge (once; long clearance TTL) — not chat/API/RSC |
| Scanners / empty UA | CF Block rules |
| Auth POSTs | CF Challenge rule |
| Leaked passwords | Supabase Auth protection (enable in dash) + hibp usage where wired |

---

## 2. Application controls

- `requireSession` on authenticated APIs
- API keys hashed at rest (`api_keys`)
- `sanitizeMessages` / rehype harden on markdown
- Bash safety for sandbox tools
- Blocked email domains
- Abuse signals / reports tables
- Data export & deletion request flows
- Security settings + `user_security_events`
- Headers in `vercel.json`: nosniff, SAMEORIGIN, referrer policy, permissions-policy, HSTS

---

## 3. Cloudflare Free-plan hardening

Documented decision (2026-07-14):

- 5/5 custom rules used
- SSL Full (strict)
- AI Labyrinth on; Block AI Training crawlers
- Browser Integrity Check on
- Under Attack OFF
- Managed WAF rulesets need Pro — not assumed
- Do not use deprecated `cf.threat_score`
- CF challenge POST→GET fixed in proxy — do not weaken rules

Details: [`cloudflare-zone-hardening.md`](./cloudflare-zone-hardening.md).

---

## 4. Database

- RLS enabled; advisor migrations applied
- SECURITY DEFINER chat RPCs: EXECUTE revoked from anon/authenticated
- GraphQL lockdown with Studio visibility preserved carefully

---

## 5. Secrets rotation

Rotate together:

1. Worker secret (`wrangler secret put`)
2. Vercel Production + Preview (sensitive)
3. Vercel Development (encrypted duplicate)
4. Redeploy app + Worker

Never paste secrets into docs or MEMORY.

---

## 6. Related

- [`../systems/authentication.md`](../systems/authentication.md)
- [`operations-runbook.md`](./operations-runbook.md)
