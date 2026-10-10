# Scheduled tasks implementation

## Work checklist

- [x] Inspect the existing task API, database migrations, assistant tools, and live Cloudflare configuration.
- [x] Add `/scheduled` and connect the sidebar entry.
- [x] Add empty state, split Create button, manual creation/edit dialog, task cards, pause/resume, deletion confirmation, and run-now action.
- [x] Add daily, weekly, monthly, and once schedules; date/month/year and time pickers; 50-character name counter; model and timezone selection; inclusive expiration.
- [x] Prefill a new chat composer with original wording without automatically sending it.
- [x] Validate real calendar dates, integer weekday/month-day values, future slots, timezone, and DST transitions.
- [x] Add durable manual runs without changing the regular cadence.
- [x] Load assistant scheduling instructions and supply a strict JSON tool schema.
- [x] Verify existing live Supabase tables and Cloudflare trigger/queue/secrets bindings.
- [ ] Deploy the updated Next.js application and verify an authenticated production task end to end.
- [x] Integrate scheduled execution with durable generation admission, stable result chats, recovery, atomic completion, and retryable notifications.

## Architecture

The authenticated Next.js API persists tasks in Supabase Postgres. Ownership is determined by the server session and enforced in repository predicates; browser-supplied user IDs are ignored. Existing migrations `20260725083000_scheduled_tasks.sql` and `20260826093629_durable_automation_queue.sql` provision tasks, execution history, RLS, idempotency keys, and leases.

The live Cloudflare Worker `clauxen-scheduled-tasks` has a `* * * * *` Cron Trigger. It calls the protected Next.js dispatch endpoint. Postgres claims due rows using `FOR UPDATE SKIP LOCKED` and generates durable run IDs. The Worker sends jobs to `clauxen-automation-runs`. Its consumer calls the protected execution endpoint, acknowledges successful jobs, retries transient failures with backoff, and sends exhausted jobs to `clauxen-automation-runs-dlq`.

Cloudflare Queues delivers at least once, so the database execution key and run acquisition lease are essential. A send failure leaves a durable claim that can be recovered after the task lease expires. The polling cadence provides minute-level scheduling, not exact-second guarantees. A run-now request records a manual run; the next Cron dispatch claims it. Its completion changes execution history, but preserves the regular next-run time and task status.

The execution endpoint transactionally attaches a stable result chat to each run, admits a turn with deterministic client IDs, and triggers the durable generation runner after returning. Queue retries find the same chat and job. Production continuations travel through an authenticated Cloudflare Worker relay with a fixed upstream origin, avoiding Bot Fight Mode challenges on Vercel loopback requests. The generation watchdog recovers interrupted slices; every-minute schedule reconciliation renews active leases and atomically records terminal run state together with the next occurrence. Pausing or editing during execution is respected. Notification delivery has its own persisted pending flag and lease; in-app notifications are unique by run ID. Email retries are at least once; the email service does not currently offer an exactly-once delivery contract. Runs requiring user input link to their result chat and record that intervention is needed.

## UI and API contract

`/scheduled` loads the task list. Create opens the chat path; its adjacent menu offers chat/manual creation. Chat creation stashes an editable starter and opens `/new?schedule=<setup-id>`. It never uses the `prompt` query parameter because that existing route sends prompts automatically.

- `GET /api/v1/scheduled-tasks`: `{data:{tasks}}`.
- `POST /api/v1/scheduled-tasks`: persist a validated task, return `{data:{task}}`, HTTP 201.
- `GET /api/v1/scheduled-tasks/:taskId`: owned task and recent runs.
- `PATCH /api/v1/scheduled-tasks/:taskId`: edit or set status to active/paused.
- `DELETE /api/v1/scheduled-tasks/:taskId`: soft delete, preserving chats/history.
- `POST /api/v1/scheduled-tasks/:taskId/run`: enqueue an owned active task, HTTP 202. Repeated clicks return the existing pending run.
- `GET /api/v1/scheduled-tasks/runs`: authenticated execution history.

Manual input uses `name`, `requirement`, `frequency`, `timeLocal`, `timezone`, `runDate`, `dayOfWeek`, `dayOfMonth`, `expiresAt`, `modelMode` (`fast`/`thinking`), and `notificationMode` (`app_only`/`email_app`/`email_only`/`off`). Dates are `YYYY-MM-DD`, local times `HH:MM`. Irrelevant cadence fields are null. Names are at most 50 characters; prompts at most 8,000. Server errors use `{error:{message,code}}`.

Expiration includes the selected calendar day in the task timezone. One-time dates must have a future time; a past time today is invalid. Monthly days 29–31 clamp to the month's final day. DST gaps shift forward by the gap; repeated times use the first occurrence. Paused schedules have no next-run instant; ended schedules require editing before resume.

## Assistant contract

The runtime loads `src/prompts/scheduled-tasks.md` together with the base assistant prompt. The executable tool catalog is `src/server/inference/autonomous-tools/definitions.ts`; dispatch is in `executor.ts`. `docs/scheduled-task-tool-schema.json` is an exported copy for integrations, not the runtime source of truth. Tool arguments use snake_case; REST input uses camelCase. Both call the same service validator and ownership checks.

Creation, listing, and cancellation use `create_scheduled_task`, `list_scheduled_tasks`, and `cancel_scheduled_task`. Never expose internal endpoints or credentials to the assistant/browser. Always inspect the actual tool result before telling the user that a task was saved.

## Cloud setup and deployment

Verified existing resources in account `8fc7a67e9057989309921f362784ecf4`:

- Worker `clauxen-scheduled-tasks`, every-minute Cron, observability enabled.
- Queue `clauxen-automation-runs`, Worker producer/consumer, batch size 3, retries 5.
- Dead-letter queue `clauxen-automation-runs-dlq`.
- Secret bindings `APP_ORIGIN` and `SCHEDULED_TASKS_INTERNAL_TOKEN` (values are never returned by inspection).
- Supabase project `ntplcfsbcyhiqklkbldk`, existing `scheduled_tasks` and `scheduled_task_runs` tables with durable columns.

No replacement cloud resources are needed. Migration `20261010032958_scheduled_task_reconciliation_indexes.sql` adds partial indexes for active reconciliation and pending notifications. The updated Worker can dispatch the new manual queue jobs after the updated Next.js API is deployed. Deployment must include the new page, API route, service/repository code, tool definition, and prompt file together. Vercel and Cloudflare must share `SCHEDULED_TASKS_INTERNAL_TOKEN`; `APP_ORIGIN` must point to the deployed Next.js app. Set Vercel `GENERATIONS_CONTINUATION_WORKER_URL` to `https://clauxen-generations-watchdog.ujjwal-8fc.workers.dev`. The relay accepts only the shared generations secret and a valid job UUID; caller-supplied origins are ignored. Existing tracing configuration includes `src/prompts/**/*`.

Check `/health` on the Worker, unauthenticated API rejection, create/read/update/pause/resume/delete, and a short-future task with an authenticated test account. Observe one run ID across queue retries and verify result history. Do not create background chats or send notification emails to a real user as a smoke test without their explicit request. Review the DLQ and Worker observability after deployment.

## Validation

Run `npx tsx --test tests/scheduled-tasks.test.ts`, `npx tsc --noEmit`, and ESLint on the changed feature files. Browser verification used an isolated temporary route with mocked API data, then removed the route. It verified manual form rendering, disabled past dates, month/year selection, time selection, weekly/monthly/once fields, name length, and editable chat prefill. Unauthenticated task API access returned 401. SQL EXPLAIN against the live Supabase schema validated the claim query. `npm run test:background:integration` passed against the built application with a dedicated fixture account and local fake model, verifying scheduled CRUD, validation, stable admission, duplicate delivery, terminal result persistence, atomic completion, preserved manual cadence, pause/edit/delete, concurrent creation, and completed-task reactivation at the 15-task quota. The fixture account is removed in `finally`. Production verification is tracked in the checklist.

The schedule tests cover future/past once runs, daily rollover, inclusive expiration, weekly cadence, short/leap months, malformed dates, fractional weekdays, DST gaps/folds, and local-time stability across DST.

References: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/), [Queues retries](https://developers.cloudflare.com/queues/configuration/batching-retries/).
