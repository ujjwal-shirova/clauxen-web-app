# Durable background generations

Chat turns run as **background jobs**, not as single HTTP requests. A turn can
take minutes or hours — it never hits the Vercel 300s function cap, and it
keeps running when the browser tab, app, or device goes away.

## How it works

A turn is a **job** made of chained **slices**:

```
POST /generate ──► job created ──► live slice (SSE, ~240s budget)
                                            ├─ completes ──► done
                                            └─ yields ──► POST /continue ──► headless slice
                                                                                    ├─ completes ──► done
                                                                                    └─ yields ──► POST /continue ──► …
```

- **Slice 0 (live)** streams SSE to the tab while it is open. If the tab
  closes, the slice keeps running headless (`after()` + `waitUntil()`).
- When the soft budget ends (~240s), the slice **yields**: it parks a full
  agent checkpoint in Postgres, marks the job `continuing`, and triggers the
  next slice through `POST /api/v1/internal/generations/continue`, which
  answers `202` immediately and runs the slice in `after()`.
- **Headless slices** drain the same agent stream with no client attached and
  chain further until the model finishes. Total turn duration is unbounded
  (safety cap: 48 slices ≈ 19h; crash-retry cap: 5 attempts per slice).

## State and checkpoints

Postgres (`public.chat_generation_jobs`) is the source of truth:

- `input` — everything needed to resume without the original HTTP request
  (messages, turn, vision, model, effort, timezone, title flag, request id).
- `checkpoint` — round-boundary agent state: next step index, full model
  `conversation` (all prior tool rounds), narration counter, answer,
  thinking, segments, tools, model turns, title, turn clock, message ids.

Checkpoints are written **after every completed tool round** and on every
yield. A resume restores the checkpoint verbatim and continues the agent
loop at the checkpointed step; an interrupted model round simply re-runs
(it has no side effects before tools execute).

Cloudflare's Durable Object keeps the **live trace** for fast UI reads
(`GET /live`), mirrored from the same state. Completion writes the
transcript to Postgres **immediately**; the 24h archive call is an
idempotent backfill, never the primary write.

## Recovery layers

1. **Chained continuation** — the yielding slice triggers the next one.
2. **Watchdog** (`/api/v1/internal/generations/watchdog`, driven every
   minute by pg_cron + pg_net — the Vercel plan only allows daily crons)
   — finds jobs with a stale heartbeat (killed invocation, crashed
   isolate, lost trigger) and knocks `/continue` for each. Claiming is
   atomic (`claim_chat_generation_job`, `FOR UPDATE SKIP LOCKED`), so
   exactly one slice ever runs a job.
3. **Checkpoints** — any replacement slice resumes from the last completed
   tool round instead of restarting the turn.

## Correctness rules

- **One active job per chat** (partial unique index). Follow-up sends during
  a running turn get `409 generation_in_progress` and their message is
  queued — same contract as the old coordinator lease.
- **Coordinator leases are per-slice.** Each slice acquires, heartbeats, and
  releases its own lease; the job row is the durable truth across the
  seconds between slices. `/generate/status` reports active when a job is
  live *or* a lease is held.
- **Stops are explicit and fast.** `POST /generate/stop` cancels the job
  row, flags the coordinator, aborts the live slice in-process, and settles
  the visible message at once. Running slices poll for cancellation every
  2s and abort within seconds.
- **At-least-once tools.** A slice killed *during* a tool execution resumes
  from the previous round and re-runs that tool. Reads/searches/writes are
  naturally idempotent; shell commands may rarely execute twice after a
  crash — the same guarantee as any retrying queue.
- **Ask-user pauses end the job** (`paused_for_user`, lease freed) so the
  user's answers start a fresh turn without `409`.
- **Retention.** The watchdog deletes terminal job rows older than 7 days.

## Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/v1/chats/:id/generate` | user | Creates the job, runs the live slice (SSE) |
| `GET /api/v1/chats/:id/generate/status` | user | `{ active, stopRequested, backgrounded, jobStatus }` |
| `POST /api/v1/chats/:id/generate/stop` | user | Cancels the durable job + lease |
| `GET /api/v1/chats/:id/live` | user | Live trace (Durable Object, job checkpoint fallback) |
| `POST /api/v1/internal/generations/continue` | internal token | Claims a job, `202`s, runs one headless slice |
| `GET/POST /api/v1/internal/generations/watchdog` | internal token | Reclaims stalled jobs, cleans old rows |

Internal auth accepts `GENERATIONS_INTERNAL_TOKEN` (preferred),
`CHAT_COORD_INTERNAL_TOKEN`, or `SCHEDULED_TASKS_INTERNAL_TOKEN` via
`x-clauxen-internal` / `Bearer`. The pg_cron callback sends
`GENERATIONS_INTERNAL_TOKEN` from `private.internal_callback_secrets`.

## Client handoff

When the live slice yields, the tab receives a single `backgrounded` event
(never `done`) and switches to polling `/status` + `/live` every 2.5s until
the job goes inactive, then settles the message exactly like a finished
live stream. Returning to the chat, reloading, or opening another device
rehydrates from the same durable trace.

## Environment

- `GENERATIONS_INTERNAL_TOKEN` (optional — falls back to the chat-coord
  secret; set it in Vercel for secret separation). The same value must be
  stored in `private.internal_callback_secrets` under
  `generations_internal_token` so pg_cron can authenticate.
- `vercel.json` wires the 300s budget for `/continue`. There is intentionally
  no Vercel Cron: this plan caps crons at daily, so pg_cron (see
  `supabase/migrations/20260929130000_generations_watchdog_cron.sql`) drives
  the per-minute watchdog instead.
