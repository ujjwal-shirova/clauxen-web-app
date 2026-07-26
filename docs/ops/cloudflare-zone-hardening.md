# Cloudflare Zone Hardening

Companion to Workers docs. Zone settings are separate from Worker deploys.

## 1. Transport & cache

| Setting | Value |
|---|---|
| SSL/TLS | Full (strict) |
| HTTP/3 | On |
| Early Hints | On |
| Tiered Cache | Smart |
| Rocket Loader | **Off** |
| Argo | Skip unless requested (paid) |

Cache Rules:

- `/_next/static*` — long cache (1y)
- `/assets*` — 1d + SWR
- `/api*` — **Bypass**

---

## 2. Security rules (Free plan constraints)

- Max **5** custom rules, **1** rate-limit rule
- **Do not** Managed-Challenge all HTML / chat shells — that re-fires on `/c/*` soft-nav and RSC (`_rsc`) and breaks SSE with “Connection was interrupted”
- Managed Challenge **only** on public auth/marketing entry (`/`, `/login`, `/signup`, `/auth/*`, `/plans`, `/contact-sales`), excluding `/api/*`, `/_next/*`, and `_rsc`
- Block scanners / empty UA / sensitive paths
- Challenge suspicious auth POSTs (empty/short UA only)
- `challenge_ttl` = 1 year so clearance is not constantly re-asked
- Under Attack mode OFF; security_level not used for blanket challenges
- AI Labyrinth on; Block AI Training crawlers; Browser Integrity Check on
- Super Bot Fight / OWASP managed rulesets need Pro

Apply via: `node scripts/ops/apply-cloudflare-challenge-policy.mjs`  
(Token needs **Zone WAF Edit** + **Zone Settings Edit** — Workers deploy token is not enough.)

**Do not** use `cf.threat_score` (deprecated on upgraded security).

---

## 3. Challenge + Vercel 405

Managed Challenge may POST back to document URLs → Vercel 405.  
Fix: `src/proxy.ts` 303 POST→GET for challenge document posts. Keep `/api` and next-action behavior intact. Do not weaken CF rules.

---

## 4. Token scopes

| Token type | Can |
|---|---|
| Account Workers deploy token | Workers, Hyperdrive |
| Zone Cache Rules edit | Cache Rules API |
| User API token with zone edit | Dashboard automation |

Cookie consent overlay in CF dash can block Deploy clicks — dismiss first.

---

## 5. Related

- [`../systems/cloudflare-workers.md`](../systems/cloudflare-workers.md)
- [`security.md`](./security.md)
- [`../perf-architecture.md`](../perf-architecture.md)
