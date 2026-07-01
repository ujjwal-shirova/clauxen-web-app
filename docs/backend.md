# Clauxen backend (Supabase Postgres)

## Prerequisites

1. Supabase project with the `supabase/migrations` schema applied (`npx supabase db push` or `npx prisma migrate dev`).
2. Root `.env.local` — single local env file (see `docs/vercel-deployment.md` for keys).
3. Auth runs on Supabase GoTrue + the dev cookie session (`AUTH_DEV_BYPASS=true`).

## Local development order

```bash
# 1. Start local Postgres (pgvector) + Redis
docker compose up -d

# 2. Apply schema
npx prisma migrate dev
npx prisma generate

# 3. Seed billing plans (via Supabase migration catalog)
#    plans are seeded by supabase/migrations/*_personal_plans_catalog.sql

# 4. App
npm run dev
```

## Environment variables

| Variable                 | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `DATABASE_URL`           | Supabase Postgres direct connection (`public` schema) |
| `AUTH_DEV_BYPASS`        | `true` enables email login via `/api/v1/auth/login` |
| `AUTH_REQUIRED_FOR_CHAT` | Require session for chat APIs                       |
| `NOVITA_API_KEY`         | Inference provider                                  |
| `SHIROVA_THINKING_MODEL` | Interleaved-thinking agent model (default `deepseek/deepseek-v4-pro`) |
| `RAZORPAY_*`             | Billing checkout + webhooks                         |

## API surface

- `GET /api/v1/auth/session` — current user (also re-syncs profile/workspace rows)
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

- **Supabase Postgres** — chats, messages, billing, projects, profiles, RAG (pgvector)
- **Supabase GoTrue** — identity / auth (email + OAuth); mirrored into `public.profiles`
- **Dev auth** — session cookie `clauxen_session` for local email/password login
- **Thinking / autonomous agent** — `POST /api/v1/chats/:id/generate` with `thinkingType: enabled` routes to `deepseek/deepseek-v4-pro` (override via `SHIROVA_THINKING_MODEL`) on Novita `/v1/chat/completions`, preserving `reasoning_content` + `tool_calls` between tool rounds
