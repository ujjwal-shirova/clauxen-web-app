# Clauxen Web App

Clauxen is a full-stack AI chat platform built with Next.js (App Router), React 19, and Supabase. It ships a complete agentic assistant experience: streaming answers, interleaved thinking phases, first-person progress narration, a live tool/activity trace in the chat view, artifacts, projects, deep research runs, scheduled tasks, billing, and a Cloudflare Workers sidecar fleet.

## Highlights

- **Agentic turn engine** — an autonomous loop over the OpenAI Responses API (`src/server/agent-core/runtime/query-loop.ts`). Each round streams reasoning → narration → strict function calls; tools execute sequentially; results feed the next round; the final round's text is promoted to the durable answer via `answer_finalize` (in place — no answer teleporting).
- **Flat agent trace** — every assistant turn carries one ordered step list (`Message.agentTrace`) of `thinking | narration | tool` steps (`src/shared/lib/agent-trace.ts`). Narration is deliberate user-facing prose ("I'm searching the web for X…"), structurally distinct from interleaved thinking, whose private content never renders.
- **Grok-style activity UI** — the chat view renders per-step trace rows with past-tense summaries ("Searched for …", "Read example.com", "Ran code") and a trailing shimmering **Working for Ns** row with a pulsing dot grid and live elapsed timer while the assistant works.
- **Tool surface** — web search/fetch, image & places search, weather, bash + code execution in a sandbox, file read/write with artifact cards, skill loading, ask-the-user questionnaires, scheduled tasks, and MCP connectors (streamable HTTP) discovered at turn start with a hard TTFT budget.
- **Streaming protocol** — a typed SSE event contract (`src/shared/lib/chat-stream.ts`, emitter in `clauxen-sse-stream.ts`, client reducer in `agent-trace-reducer.ts`) covering thinking phases, narration deltas, tool lifecycles with stdout/stderr streaming, search-result cards, artifact upserts, and inline chat titles.

## Tech stack

| Layer      | Tech |
|------------|------|
| Framework  | Next.js 16 (App Router), React 19, TypeScript |
| Styling    | Tailwind CSS 4, shadcn/radix primitives, tw-animate-css |
| Data       | Supabase (Postgres + pgvector, Auth incl. magic links/WebAuthn, Storage) |
| State      | Zustand store, React Query |
| AI         | OpenAI Responses API, Exa search, Novita sandbox, MCP connectors, BullMQ + Redis queues |
| Edge       | Cloudflare Workers: auth-email, billing (invoice PDFs), chat-coord, chat-history, R2 gateway, scheduled tasks |
| Payments   | Razorpay |

## Project layout

```
src/
  app/                 # App Router routes: marketing, auth, checkout, api/v1/*
  client/
    components/        # Chat UI, agent trace components, composer, settings…
    hooks/             # use-chat-api (stream lifecycle), scroll, visibility…
    stores/            # Zustand chat store
  server/
    agent-core/        # Agent loop, provider client, tool registry
    inference/         # SSE stream, autonomous tools, sandbox, prompts
    mcp/               # MCP connector harness + registry
    chat/, services/, repositories/, billing/, sandbox/, training/ …
  shared/lib/          # Isomorphic libs: agent-trace*, chat-stream, hydration…
supabase/migrations/   # Schema: chats, messages, tool_calls, research, billing…
workers/               # Cloudflare Worker services
scripts/               # Ops/deploy/env-sync utilities
```

## Getting started

Requirements: Node 24.x, npm ≥ 10.

```bash
npm install
cp .env.example .env.local   # fill in Supabase, API keys, etc.
docker compose up -d         # local Postgres (pgvector) + Redis for BullMQ
npm run db:push              # apply Supabase schema (or supabase db push)
npm run dev                  # http://localhost:9002
```

Useful scripts:

| Command                | Purpose |
|------------------------|---------|
| `npm run dev`          | Dev server on port 9002 |
| `npm run build`        | Production build (bootstraps DB env first) |
| `npm run lint`         | ESLint with zero warnings allowed |
| `npm run typecheck`    | Next typegen + `tsc --noEmit` |
| `npm run format`       | Prettier across the repo |
| `npm run worker`       | Local BullMQ worker |
| `npm run supabase:*`   | DB push / deploy edge functions |

> Never prefix secrets with `NEXT_PUBLIC_` — those are embedded in the browser bundle. See `.env.example`.

## Agent protocol cheat sheet

```
start / turn_ready            → turn lifecycle + durable ids
segment_start/end             → thinking | narration phase markers
thinking_start/delta/end      → reasoning-phase presence (no CoT text)
narration_delta               → first-person progress prose / answer text
answer_finalize               → promotes final narration to Message.content
tool_start/output_delta/data  → tool lifecycle (args streaming, stdout, hits)
tool_end                      → completion + error flag
artifact_upsert               → create_file deliverable cards
chat_title / error / done     → housekeeping + close
```

The client folds these events into `Message.agentTrace`; persistence stores the trace on the message record, and hydration auto-migrates older frames/segments-shaped transcripts into the flat model.

## Deployment

Vercel hosts the Next.js app (`vercel.json`, env sync via `scripts/sync-vercel-env-api.mjs`); Cloudflare Workers are deployed with `scripts/deploy-cloudflare-workers.sh`; Supabase migrations ship through the Supabase CLI.
