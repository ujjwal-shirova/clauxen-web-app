# clauxen-scheduled-tasks

Cloudflare Worker cron that wakes the Next.js app to run due scheduled tasks.

## Flow

```
Cron (* * * * *)
  → Worker POST /api/v1/internal/scheduled-tasks/dispatch?async=1
  → Vercel claims due rows (SKIP LOCKED)
  → Creates a chat per task + runs agent stream
  → Writes scheduled_task_runs + advances next_run_at
```

## Secrets

```bash
cd workers/scheduled-tasks
npx wrangler secret put SCHEDULED_TASKS_INTERNAL_TOKEN
npx wrangler secret put APP_ORIGIN   # https://clauxen.com
npx wrangler deploy
```

Set the same `SCHEDULED_TASKS_INTERNAL_TOKEN` on Vercel (Production + Preview).

## Manual poke

```bash
curl -X POST "$WORKER_URL/v1/dispatch" \
  -H "authorization: Bearer $SCHEDULED_TASKS_INTERNAL_TOKEN"
```
