# API Reference

Base: same origin as the app. Primary surface: **`/api/v1/*`**.  
Auth: Supabase session cookie/JWT, or `Authorization: Bearer clx_…` API key, or (dev) `clauxen_session`.

Unless noted, routes require a session. Errors use `AppError` JSON shapes with HTTP status + optional `code`.

Streaming routes set `CLAUXEN_STREAM_HEADERS` and `maxDuration` up to 300s (see `vercel.json`).

---

## 1. Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/auth/session` | optional | Current user; `?quiet=1` skips heavy sync |
| POST | `/api/v1/auth/login` | public | Dev bypass login (503 in prod) |
| POST | `/api/v1/auth/register` | public | Dev bypass register (503 in prod) |
| POST | `/api/v1/auth/logout` | session | Sign out |
| POST | `/api/v1/auth/validate-email` | public | Email validation / blocked domains |
| GET/POST | `/api/v1/auth/email-status` | public | Existence / status for unified login |
| POST | `/api/v1/auth/signup/request-otp` | public | Send signup OTP via Worker |
| POST | `/api/v1/auth/signup/verify` | public | Verify OTP |
| POST | `/api/v1/auth/magic/request` | public | Request magic link |
| POST | `/api/v1/auth/magic/inspect` | public | Inspect magic token |
| POST | `/api/v1/auth/magic/complete` | public | Complete magic signup |

Legacy: `POST /api/auth/login`, `POST /api/auth/register`.

Document routes: `/auth/callback`, `/auth/confirm`, `/auth/magic`, `/auth/reset-password`.

---

## 2. Profile, onboarding, settings

| Method | Path | Purpose |
|---|---|---|
| GET/PATCH | `/api/v1/profile` | Profile fields |
| GET/POST/PATCH | `/api/v1/onboarding` | Onboarding state / answers |
| GET/PATCH | `/api/v1/settings` | `user_settings` JSONB blob |
| GET/PATCH | `/api/v1/settings/security` | Security settings |
| GET | `/api/v1/settings/storage` | Storage usage |
| GET/POST | `/api/v1/settings/connected-accounts` | Linked accounts |
| POST | `/api/v1/settings/data-export` | Request export job |
| POST | `/api/v1/settings/data-deletion` | Request deletion |

---

## 3. Chats

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/chats` | List chats |
| POST | `/api/v1/chats` | Create chat |
| GET | `/api/v1/chats/search` | Search |
| GET | `/api/v1/chats/:chatId` | Metadata |
| PATCH | `/api/v1/chats/:chatId` | Update (title, etc.) |
| DELETE | `/api/v1/chats/:chatId` | Delete |
| GET/POST | `/api/v1/chats/:chatId/messages` | Messages |
| POST | `/api/v1/chats/:chatId/generate` | **SSE** generate |
| POST | `/api/v1/chats/:chatId/generate/stop` | Stop |
| PUT | `/api/v1/chats/:chatId/branches` | Branch state |
| POST | `/api/v1/chats/:chatId/pin` | Pin |
| POST | `/api/v1/chats/:chatId/title` | Title |
| POST | `/api/v1/chats/:chatId/share` | Share |
| GET | `/api/v1/chats/:chatId/transcript` | Transcript export |
| GET | `/api/v1/share/:token` | Public share |

Legacy: `POST /api/chat`, `POST /api/chat/title`.

Preferred sidebar list/messages at edge: Worker `GET /v1/chats`, `GET /v1/chats/:id/messages` (see workers doc).

---

## 4. Files

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/files/presign` | Create `user_files` + upload URL |
| POST | `/api/v1/files/complete` | Finalize upload |
| GET | `/api/v1/files/:fileId/url` | Signed/read URL |

Upload bytes go to **r2-gateway**, not Vercel.

---

## 5. Projects

### v1

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/v1/projects` | List / create |
| GET/PATCH/DELETE | `/api/v1/projects/:projectId` | CRUD |
| GET/POST | `/api/v1/projects/:projectId/chats` | Project chats |

### Legacy `/api/projects/*`

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/projects` | List / create |
| GET/PATCH/DELETE | `/api/projects/:id` | CRUD |
| GET/PUT | `/api/projects/:id/instructions` | Instructions |
| GET/POST | `/api/projects/:id/files` | Upload files |
| GET/DELETE | `/api/projects/:id/files/:fileId` | File |
| GET | `/api/projects/:id/files/:fileId/status` | Ingestion status |
| GET/POST | `/api/projects/:id/conversations` | Conversations |
| GET/DELETE | `/api/projects/:id/conversations/:convId` | Conversation |
| GET/POST | `/api/projects/:id/conversations/:convId/messages` | Messages |

---

## 6. Billing & gifts

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/billing/plans` | Plan catalog |
| GET | `/api/v1/billing/subscription` | Current sub |
| POST | `/api/v1/billing/subscription/cancel` | Cancel |
| POST | `/api/v1/billing/orders` | Create order |
| POST | `/api/v1/billing/orders/verify` | Verify payment |
| POST | `/api/v1/billing/orders/upi` | UPI order |
| GET | `/api/v1/billing/orders/upi/poll` | Poll UPI |
| POST | `/api/v1/billing/checkout-sessions` | Checkout session |
| GET | `/api/v1/billing/invoices` | Invoices |
| POST | `/api/v1/webhooks/razorpay` | Webhook (signature) |
| POST | `/api/v1/gifts/purchase` | Purchase gift |
| POST | `/api/v1/gifts/redeem` | Redeem code |
| GET | `/api/v1/geo/checkout-default` | Geo/default currency hint |

Checkout pages: `/checkout/[merchant]/[sessionId]`.

---

## 7. Customize (skills & connectors)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/v1/customize/skills` | List / create skills |
| POST | `/api/v1/customize/skills/upload` | Upload skill package (60s) |
| GET/POST | `/api/v1/customize/connectors` | Connectors |

---

## 8. Sandbox

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/sandbox` | Create sandbox |
| GET/DELETE | `/api/v1/sandbox/:sandboxId` | Get / destroy |
| POST | `/api/v1/sandbox/:sandboxId/connect` | Connect |
| POST | `/api/v1/sandbox/:sandboxId/commands` | Run command |
| GET/PUT | `/api/v1/sandbox/:sandboxId/files` | Files |
| GET | `/api/v1/sandbox/:sandboxId/host` | Host URL |
| GET | `/api/v1/sandbox/:sandboxId/metrics` | Metrics |
| POST | `/api/v1/sandbox/:sandboxId/pause` | Pause |
| POST | `/api/v1/sandbox/:sandboxId/timeout` | Timeout |

Memory 1024 / maxDuration 300 on these functions.

---

## 9. Agent

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/chats/:id/generate` | Main chat SSE (agent-core loop) |
| POST | `/api/v1/agent/chat` | Agent chat |
| GET | `/api/v1/agent/models` | Models |
| POST | `/api/v1/agent/sandbox` | Agent sandbox |
| POST | `/api/v1/agent/stream` | Agent SSE |

Removed: `/api/autonomous-agent/*` (legacy standalone package).

---

## 10. Inference proxies

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/shirova/v1/messages` | Anthropic Messages API-compatible proxy |
| POST | `/api/v1/novita/structured` | Structured output |
| POST | `/api/v1/novita/vision` | Vision |

Provider Anthropic URL derived from `Provider_BASE_URL` (`/openai` → `/anthropic`).

---

## 11. Workspaces

| Method | Path | Purpose |
|---|---|---|
| GET/PATCH | `/api/v1/workspaces/current` | Current workspace |
| GET/POST | `/api/v1/workspaces/members` | Members |
| GET/POST | `/api/v1/workspaces/domains` | Verified domains |
| GET/POST | `/api/v1/workspaces/sso-connections` | SSO |
| GET/POST | `/api/v1/workspaces/scim-tokens` | SCIM tokens |

---

## 12. Research, artifacts, API keys

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/v1/research/runs` | Research runs |
| GET | `/api/v1/research/runs/:id` | Run detail |
| GET/POST | `/api/v1/artifacts` | Artifacts |
| GET/POST | `/api/v1/api-keys` | Create/list keys |
| DELETE | `/api/v1/api-keys/:keyId` | Revoke |

---

## 13. Well-known

| Method | Path | Purpose |
|---|---|---|
| GET | `/.well-known/apple-developer-merchantid-domain-association` | Apple Pay domain assoc |

---

## 14. Caching headers

`vercel.json` forces `/api/*` → `private, no-store` (and CDN no-store).  
Do not cache authenticated API responses at the zone.

---

## 15. Related

- [`../systems/chat-system.md`](../systems/chat-system.md)
- [`../systems/authentication.md`](../systems/authentication.md)
- [`../systems/billing-and-checkout.md`](../systems/billing-and-checkout.md)
