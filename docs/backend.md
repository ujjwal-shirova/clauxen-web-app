# Clauxen backend (CockroachDB + Ory)

## Prerequisites

1. CockroachDB Cloud cluster with `clauxen_main` schema (`npm run crdb:schema-fast` or `npm run crdb:apply-native`).
2. Root `.env.local` — single local env file (see `docs/vercel-deployment.md` for keys).
3. Optional: Ory stack for production-grade auth.

## Local development order

```bash
# 1. Schema (if needed)
npm run crdb:schema-fast

# 2. Seed billing plans
npm run crdb:seed-plans

# 3. Ory (optional — dev auth works without it)
docker compose -f infra/ory/docker-compose.yml up -d

# 4. App
npm run dev
```

## Environment variables

| Variable                 | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `COCKROACH_DATABASE_URL` | Product database (`clauxen_main`)                   |
| `AUTH_DEV_BYPASS`        | `true` enables email login via `/api/v1/auth/login` |
| `AUTH_REQUIRED_FOR_CHAT` | Require session for chat APIs                       |
| `NOVITA_API_KEY`         | Inference provider                                  |
| `SHIROVA_THINKING_MODEL` | Interleaved-thinking agent model (default `deepseek/deepseek-v4-pro`) |
| `RAZORPAY_*`             | Billing checkout + webhooks                         |
| `ORY_KRATOS_PUBLIC_URL`  | Kratos whoami (when using Ory)                      |

## API surface

- `GET /api/v1/auth/session` — current user (also re-syncs profile/workspace rows in CRDB)
- `POST /api/v1/auth/login` | `register` | `logout` — writes `user_security_events` on success
- `POST /api/v1/chats/:id/messages` — persist user message before generation
- `GET/POST /api/v1/api-keys` — API keys (`clx_…`); use `Authorization: Bearer clx_…` on any v1 route
- `POST /api/shirova/v1/messages` — Anthropic Messages API proxy (Novita/Kimi)
- `GET/POST /api/v1/chats` — chat list/create
- `POST /api/v1/chats/:id/generate` — SSE streaming
- `GET/POST /api/v1/projects`
- `GET/POST /api/v1/billing/orders`
- `POST /api/v1/webhooks/razorpay`

Legacy routes `/api/chat` and `/api/chat/title` remain for unauthenticated/local fallback.

## Architecture

- **CockroachDB** — chats, messages, billing, projects, profiles
- **Ory Kratos + Hydra** — identity/OIDC (Postgres in Docker for Ory persistence)
- **Dev auth** — session cookie `clauxen_session` + `auth.users` shim sync
- **Thinking / autonomous agent** — `POST /api/v1/chats/:id/generate` with `thinkingType: enabled` routes to `deepseek/deepseek-v4-pro` (override via `SHIROVA_THINKING_MODEL`) on Novita `/v1/chat/completions`, preserving `reasoning_content` + `tool_calls` between tool rounds
