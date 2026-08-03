# Clauxen

Clauxen is an AI-powered chat platform built on Next.js — multi-model conversations, project-scoped RAG, an autonomous tool-use agent, code sandboxes, billing/subscriptions, and enterprise workspace controls, all in one app.

## Feature highlights

- **Streaming chat** — SSE-based conversation streaming with per-model routing, interleaved "thinking" traces, and custom token fade-in for animated markdown.
- **Multi-model routing** — internal model personas (**Homer**, **Helios**, **Virgil**) proxied through Novita's Anthropic- and OpenAI-compatible endpoints, plus a Claude-Messages-API-compatible proxy at `/api/shirova/v1/messages`.
- **Autonomous agent** — Provider-backed tool-use loop via `@/server/agent-core` (web search, sandbox, files, skills). Streams to `src/client/components/agent/*`.
- **Projects & RAG** — project folders with custom instructions, file uploads, chunking + embeddings, and pgvector-backed retrieval grounding chat responses.
- **Code sandboxes** — provision, connect to, and run commands/files inside remote sandboxes (`/api/v1/sandbox/*`, Novita sandbox).
- **Billing & checkout** — Razorpay-based orders, subscriptions, invoices, plans, UPI flow, and gifting, with webhook handling.
- **Workspaces** — SSO connections, SCIM tokens, member management, and verified domains for team accounts.
- **Customize** — user-uploaded skills and third-party connectors.
- **API keys** — `clx_…` bearer tokens for programmatic access to the `/api/v1/*` surface.
- **Library, artifacts, research runs, onboarding** — supporting surfaces for saved outputs, generated files, longer-running research jobs, and first-run setup.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js (App Router), React 19, Tailwind CSS v4, shadcn/ui, Zustand, TanStack Query |
| Streaming / Markdown | Server-Sent Events, custom token fade-in for animated markdown |
| API | Next.js Route Handlers (`/api/v1/*`, legacy `/api/*`) |
| Database | Supabase Postgres (`supabase/migrations` + `pg` pool), pgvector-style embeddings |
| Auth | Supabase GoTrue, with a dev cookie-session bypass (`AUTH_DEV_BYPASS`) |
| Inference | Novita (Anthropic- and OpenAI-compatible endpoints) — models: Kimi K2.6, GLM-5.2, DeepSeek V4 Pro (thinking) |
| Storage | Cloudflare R2 (images, documents, artifacts, skills, chat archives), local-disk fallback |
| Queue | BullMQ + Redis (project file ingestion), inline fallback if Redis is unavailable |
| Billing | Razorpay (orders, subscriptions, invoices, webhooks) |
| Search / tools | Exa (web search/fetch), Fal (image), Parallel, Google Places |
| Sandboxes | Novita sandbox (E2B-compatible) |

## Repository structure

| Path | Purpose |
|---|---|
| `src/app/` | Next.js App Router — pages and `/api` route handlers |
| `src/client/components/` | React UI (incl. `agent/` chat transcript) |
| `src/client/hooks/`, `contexts/`, `stores/`, `features/` | Client state and feature modules |
| `src/client/workers/` | Browser workers (e.g. search) |
| `src/shared/lib/` | Shared client + isomorphic helpers |
| `src/shared/utils/` | Utilities (incl. Supabase clients) |
| `src/shared/types/` | Shared TypeScript types |
| `src/modules/projects/` | Project RAG pipeline (ingestion, chunking, embeddings) |
| `src/app/globals.css` | Single product chrome stylesheet (tokens, pages, chat, menus) |
| `src/marketing/` | Marketing site components and content |
| `src/prompts/` | Model system prompts + personalization `.md` |
| `src/server/` | Server-only services, repos, inference, auth, billing |
| `src/server/agent-core/` | Chat agent loop (Provider Messages + tools) |
| `supabase/` | Supabase config and SQL migrations |
| `workers/` | Cloudflare Workers (chat-history, r2-gateway, chat-coord, …) |
| `scripts/` | Deploy, env sync, seed scripts, ingestion worker |

## Getting started

### Prerequisites

- Node.js `24.x` (`.nvmrc` / `engines` in `package.json`), npm `>=10`
- A Supabase project (Postgres + GoTrue)
- Redis (optional locally — falls back to inline processing)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create **`.env.local`** at the repo root from **`.env.example`** (committed template).

Minimum to get chat working:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:9002
AUTH_DEV_BYPASS=true
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...
Provider_API_Key=...
Provider_BASE_URL=...
Provider_Model_Clauxen_V1=moonshotai/kimi-k2.6
JWT_SECRET=...
```

### 3. Apply the database schema

```bash
npx supabase db push
```

### 4. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:9002](http://localhost:9002).

### 5. Optional background processes

```bash
npm run worker                 # BullMQ project-file ingestion worker
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server on port `9002` |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` / `lint:fix` | ESLint check / autofix |
| `npm run typecheck` | Next type generation + `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier write / check |
| `npm run test` | Run `*.test.ts` files under `src/` via `tsx --test` |
| `npm run worker` | Start the BullMQ ingestion worker |
| `npm run supabase:blocked-emails:seed` | Seed blocked email domains from `disposable.txt` |
| `npm run supabase:db:push` | Push local migrations to Supabase |
| `npm run supabase:functions:deploy` / `:list` | Manage Supabase Edge Functions |

## Data flow: where things live

| Store | What | Examples |
|---|---|---|
| **Supabase Postgres** | Relational app data, metadata pointers | `profiles`, `chats`, `chat_messages`, `user_files`, `subscriptions` |
| **Cloudflare R2** | Binary blobs only | Avatars, chat images, project uploads, artifacts, skill packages |
| **CF Worker (`CHAT_HISTORY_WORKER_URL`)** | Keyset chat pages: Cache API → KV → R2 → Hyperdrive | Miss-only Postgres; `x-clauxen-cache` header |
| **CF Worker (`WORKER_URL`)** | Auth-gated upload/download to R2; Cache API on reads | Large file uploads bypass Vercel 4.5 MB limit |
| **Browser localStorage** | Offline chat fallback when `AUTH_REQUIRED_FOR_CHAT=false` | IndexedDB path in `use-chat.ts` |
| **D1** | Not used | See `docs/backend-audit.md` for rationale |

Flow: user uploads → `POST /api/v1/files/presign` creates `user_files` row → client PUTs to R2 gateway Worker (Bearer Supabase JWT) → `POST /api/v1/files/complete` finalizes. Chat attachments link via `chat_message_parts.file_id` (+ `metadata.attachments` for UI reload).

Deploy Workers: `./scripts/deploy-cloudflare-workers.sh` (requires `CLOUDFLARE_API_TOKEN`).

## API surface

Full endpoint list and architecture in [`docs/backend.md`](docs/backend.md). Highlights:

- `GET /api/v1/auth/session`, `POST /api/v1/auth/{login,register,logout}`
- `GET/POST /api/v1/chats`, `POST /api/v1/chats/:id/{messages,generate}` (SSE streaming)
- `GET/POST /api/v1/projects`, `/api/v1/projects/:id`
- `GET/POST /api/v1/api-keys` — issue `clx_…` keys for `Authorization: Bearer` access
- `POST /api/shirova/v1/messages` — Anthropic Messages API-compatible proxy
- `/api/v1/billing/*`, `/api/v1/webhooks/razorpay`
- `/api/v1/sandbox/*` — sandbox lifecycle and command execution
- `/api/v1/workspaces/*` — SSO, SCIM, members, domains
- `/api/v1/customize/{skills,connectors}`, `/api/v1/research/runs`, `/api/v1/artifacts`

Legacy `/api/chat` and `/api/chat/title` remain for the unauthenticated/local fallback path.

## Environment variables

See [`docs/vercel-deployment.md`](docs/vercel-deployment.md) for the complete, up-to-date list (including Cloudflare R2 buckets and Vercel project settings). Core groups:

| Group | Examples |
|---|---|
| App | `NEXT_PUBLIC_APP_URL`, `AUTH_DEV_BYPASS`, `AUTH_REQUIRED_FOR_CHAT` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` |
| Inference | `Provider_API_Key`, `Provider_BASE_URL`, `Provider_SANDBOX_TIMEOUT_MS`, `Provider_Model_Clauxen_V1` (server-only / Sensitive) |
| Search / tools | `EXA_API_KEY`, `FAL_KEY`, `PARALLEL_API_KEY`, `GOOGLE_PLACES_API_KEY` |
| Billing | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Storage | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`, `R2_*_BUCKET`, `WORKER_URL` |
| Auth | `JWT_SECRET` |
| Queue | `REDIS_URL` (optional — inline fallback if unset) |

## Deployment

Deployed on Vercel. `vercel.json` sets install/build commands and streaming route timeouts. Cloudflare R2 is required in production (Vercel functions have no persistent disk). Full checklist in [`docs/vercel-deployment.md`](docs/vercel-deployment.md).

```bash
vercel link
vercel --prod
```

## License

Private — Clauxen internal use.
