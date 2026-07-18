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
- Managed Challenge on app HTML entry
- Block scanners / empty UA / sensitive paths
- Challenge suspicious auth POSTs
- Keep leaked-credential rate rule
- Under Attack mode OFF (custom challenge is targeted)
- AI Labyrinth on; Block AI Training crawlers; Browser Integrity Check on
- Super Bot Fight / OWASP managed rulesets need Pro

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
