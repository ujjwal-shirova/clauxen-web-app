# Clauxen

Clauxen is an AI-powered chat platform built on Next.js — multi-model conversations, project-scoped RAG, an autonomous tool-use agent, code sandboxes, billing/subscriptions, and enterprise workspace controls, all in one app.

## Feature highlights

- **Streaming chat** — SSE-based conversation streaming with per-model routing, interleaved "thinking" traces, and animated markdown rendering (vendored [`flowtoken`](lib/flowtoken)).
- **Multi-model routing** — internal model personas (**Homer**, **Helios**, **Virgil**) proxied through Novita's Anthropic- and OpenAI-compatible endpoints, plus a Claude-Messages-API-compatible proxy at `/api/shirova/v1/messages`.
- **Autonomous agent** — a no-system-prompt, tool-steered reasoning loop (`src/autonomous-agent/`) with web search, web fetch, sandboxed code execution, scoped file read/write, skill discovery, and user-clarification pauses. See its own [README](src/autonomous-agent/README.md).
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
| Streaming / Markdown | Server-Sent Events, vendored `flowtoken` for token-level animated markdown |
| API | Next.js Route Handlers (`/api/v1/*`, legacy `/api/*`) |
| Database | Supabase Postgres (Prisma ORM + `supabase/migrations`), pgvector-style embeddings |
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
| `src/app/` | Next.js routes — pages and `/api` route handlers |
| `src/frontend/` | Client components, hooks, and frontend-only lib code |
| `src/backend/` | Server-side services, repositories, inference pipeline, billing, sandbox |
| `src/autonomous-agent/` | Standalone tool-use agent loop (server + client + types) |
| `src/projects/` | Project RAG pipeline (ingestion, chunking, embeddings, storage) |
| `src/models-system-prompts/` | Persona system prompts (e.g. `virgil.md`) |
| `src/lib/`, `src/utils/` | Shared utilities (Supabase clients, model config, sanitization) |
| `lib/flowtoken/` | Vendored animated-markdown-streaming library |
| `prisma/` | Prisma schema and migrations |
| `supabase/` | Supabase project config and SQL migrations |
| `scripts/` | Standalone scripts (ingestion worker, seeding) |
| `docs/` | Deployment and backend architecture notes |

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

Create **`.env.local`** at the repo root — the single local env file (no `.env.example`; see `docs/vercel-deployment.md` for the full variable list and production setup).

Minimum to get chat working:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:9002
AUTH_DEV_BYPASS=true
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...
NOVITA_AI_KEY=...
JWT_SECRET=...
```

### 3. Apply the database schema

```bash
npx prisma migrate dev
npx prisma generate
# or, for the Supabase-managed schema:
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
npm run autonomous-agent:ws    # standalone autonomous-agent WebSocket server (:8081)
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
| `npm run autonomous-agent:ws` | Start the autonomous-agent WebSocket server |
| `npm run prisma:generate` / `prisma:migrate` / `prisma:studio` | Prisma client, migrations, DB GUI |
| `npm run supabase:db:push` | Push local migrations to Supabase |
| `npm run supabase:functions:deploy` / `:list` | Manage Supabase Edge Functions |

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
| Inference | `NOVITA_AI_KEY`, `SHIROVA_HOMER_MODEL`, `SHIROVA_HELIOS_MODEL`, `SHIROVA_VIRGIL_MODEL`, `SHIROVA_THINKING_MODEL` |
| Search / tools | `EXA_API_KEY`, `FAL_KEY`, `PARALLEL_API_KEY`, `GOOGLE_PLACES_API_KEY` |
| Billing | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Storage | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`, `R2_*_BUCKET` |
| Auth | `JWT_SECRET` |
| Queue | `REDIS_URL` (optional — inline fallback if unset) |

## Deployment

Deployed on Vercel. `vercel.json` sets install/build commands and streaming route timeouts; `vercel-build` runs `prisma generate` before `next build`. Cloudflare R2 is required in production (Vercel functions have no persistent disk). Full checklist in [`docs/vercel-deployment.md`](docs/vercel-deployment.md).

```bash
vercel link
vercel --prod
```

## License

Private — Clauxen internal use.
