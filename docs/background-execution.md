# Durable assistant execution

Every accepted chat prompt now becomes a server-owned job. Closing the tab, navigating to another chat, or shutting down the device does not cancel it. An explicit Stop request cancels the chat's queued and running jobs.

## Execution and reconnect

1. The generate endpoint authenticates the user, locks their chat, reserves user/assistant message rows, and inserts a queued `chat_generation_jobs` row in one database transaction. It acknowledges with HTTP 202 and `turn_ready` / `backgrounded` events after committing. Retrying the same assistant client ID returns the original job.
2. The internal continuation endpoint atomically claims the oldest eligible job. Only one job runs per chat; different chats can run concurrently. Vercel `after()` runs the slice independently of the response connection.
3. The agent saves durable round checkpoints, a tool execution journal, and terminal model outcomes in Postgres. Streaming snapshots update the assistant message and optionally the Cloudflare Durable Object live mirror. Every database write is fenced by the current job owner.
4. A slice yields at a round boundary and triggers its continuation. The Cloudflare watchdog runs every minute and recovers missed dispatches and workers whose heartbeat has been stale for at least 90 seconds. Recovery does not depend on an open browser.
5. The client polls durable status and live progress while background execution is active. On reopen, online reconnect, or completion it loads authoritative chat history. A dropped stream never manufactures a completed answer.

Supabase owns job state and final transcripts. Cloudflare owns live coordination and periodic recovery. Vercel runs the existing agent/provider/tool stack; no new queue vendor is required. Preview jobs retain their server-derived deployment origin so recovery runs the matching code version. Protected preview continuations use `VERCEL_AUTOMATION_BYPASS_SECRET`. Production continuations use the authenticated Cloudflare watchdog relay configured with `GENERATIONS_CONTINUATION_WORKER_URL`; its destination is fixed to `CONTINUATION_ORIGIN`, the direct production Vercel alias. The Worker supplies its secret `VERCEL_AUTOMATION_BYPASS_SECRET` for Vercel deployment protection. This avoids Bot Fight Mode challenges through the public domain while keeping both protections enabled.

## Failure semantics and limits

Completed tool results are checkpointed and replayed without invoking the tool again. If a process dies while an external tool is in flight and its outcome was never saved, the task fails instead of automatically repeating a potentially irreversible operation. Exactly-once external side effects require the external service to support idempotency keys or reconciliation; the execution journal alone cannot guarantee that.

The current safeguards allow 24 agent steps, 48 slices, a 240-second soft slice deadline, a 270-second hard deadline, and five consecutive crash recovery attempts. This is roughly a 3.6-hour aggregate slice budget, subject to provider/tool timeouts. Paused tasks await a new user response. Terminal checkpoints are retained for seven days; chat transcripts remain in chat history. Submission deduplication via job keys therefore has the same seven-day retention window.

## Configuration and deployment

- Vercel: `GENERATIONS_CONTINUATION_WORKER_URL`, database connection, existing model/provider credentials, Supabase auth configuration, and `GENERATIONS_INTERNAL_TOKEN` (or the existing coordinator/scheduler internal secret fallback). Optional `CHAT_COORD_WORKER_URL` and its shared token enable live coordination.
- Cloudflare `clauxen-generations-watchdog`: `APP_ORIGIN`, `CONTINUATION_ORIGIN`, `GENERATIONS_INTERNAL_TOKEN`, `VERCEL_AUTOMATION_BYPASS_SECRET`, and the existing once-per-minute cron. The app and watchdog must share an accepted internal token.
- Cloudflare `clauxen-chat-coord`: existing Durable Object binding and `CHAT_COORD_INTERNAL_TOKEN`. Live coordination is optional; durable jobs still run if the mirror is unavailable.
- Supabase: apply `20261009153827_durable_chat_admission_and_fencing.sql` and `20261009154709_fix_thread_history_nested_windows.sql`. The latter fixes the existing nested-window query error that prevented reconnect history from loading.

The migrations and workers are applied to the linked cloud resources. The complete application is deployed from `master` to production.

## Verification

`npm run test:background` runs stream, tool journal, checkpoint failure, watchdog retry, and authenticated relay regressions without calling providers.

Run `tests/background-generation.database.sql` inside `BEGIN` / `ROLLBACK` against a database with an idle fixture chat to verify queue ordering, duplicate submission, single ownership, crash takeover, cancellation, and browser-role isolation. This test rolls back its job fixtures.

After `npm run build`, run `npm run test:background:integration` with configured Supabase public/service credentials and `DATABASE_URL`. The test creates and deletes a dedicated auth user, starts the built app locally, supplies a delayed local fake model, closes the accepted response connection, and verifies running progress, persisted completion, history reload, duplicate acknowledgement, and cancellation. It never calls a real model. To use an existing private env export, invoke Node with `--env-file` before the tsx CLI.

Production verification on October 10, 2026 passed the real scheduled Cron → Queue → durable generation → saved result → terminal reconciliation → in-app notification flow. The production relay returned HTTP 202 through the direct Vercel alias. Its dedicated protection bypass is stored only in the Worker secret binding; public bot and deployment protections remain enabled. The disposable test user and data were removed.
