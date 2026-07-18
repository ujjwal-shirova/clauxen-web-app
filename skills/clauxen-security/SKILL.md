---
name: clauxen-security
description: >-
  Clauxen security: secrets handling, RLS, CF WAF rules, proxy challenge fix, API keys, webhook verification. Use when doing security review, adding authz, rotating tokens, CF custom rules, or preventing secret leaks.
---

# Clauxen security

## Read first

- `docs/ops/security.md`
- `docs/ops/cloudflare-zone-hardening.md`
- `docs/reference/gotchas-encyclopedia.md`

## Never

- Prefix secrets with `NEXT_PUBLIC_`
- Store secrets in `brain/MEMORY.md` or docs
- Call SECURITY DEFINER chat RPCs from anon
- Weaken CF rules to “fix” Vercel 405 (use proxy 303)
- Enable paid Argo/add-ons unprompted

## Must

- Fail closed on missing Provider/Exa keys
- Verify Razorpay webhook signatures
- Bearer JWT on r2-gateway uploads
- Internal tokens on Worker admin routes
- Rotate Worker + all Vercel targets together

## CF Free pack (do not casually change)

Managed Challenge on HTML entry; Block scanners/empty-UA/sensitive paths; Challenge suspicious auth POSTs; SSL Full strict; Under Attack OFF; no `cf.threat_score`.

## Additional resources

- [reference.md](reference.md)
