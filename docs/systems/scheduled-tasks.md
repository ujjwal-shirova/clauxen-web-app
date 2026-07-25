# Scheduled Tasks

ChatGPT/Claude-style automations: save a prompt + cadence, run unattended into a new chat, manage from `/scheduled`.

## Surfaces

| Layer | Path |
|-------|------|
| UI | `/scheduled` → `ScheduledTasksView` |
| CRUD API | `/api/v1/scheduled-tasks` |
| Cron dispatch | `/api/v1/internal/scheduled-tasks/dispatch` |
| Worker | `workers/scheduled-tasks` (cron `* * * * *`) |
| Agent tools | `create_scheduled_task`, `list_scheduled_tasks`, `cancel_scheduled_task` |

## Data (Supabase)

- `scheduled_tasks` — user-owned; RLS `user_id = auth.uid()`
- `scheduled_task_runs` — execution history (select own)

Frequencies: `once` | `daily` | `weekly` | `monthly`. Local `time_local` + IANA `timezone` drive `next_run_at`.

## Execution flow

1. Cloudflare Worker cron POSTs dispatch with `SCHEDULED_TASKS_INTERNAL_TOKEN`.
2. App claims due rows (`FOR UPDATE SKIP LOCKED` + 30m lease on `next_run_at`).
3. For each task: create chat → `streamChatGeneration` with the requirement → record run → advance or complete.

## Ops

```bash
# Vercel (Production + Preview)
SCHEDULED_TASKS_INTERNAL_TOKEN=<random hex>

# Worker
cd workers/scheduled-tasks
npx wrangler secret put SCHEDULED_TASKS_INTERNAL_TOKEN
npx wrangler secret put APP_ORIGIN   # https://clauxen.com
npx wrangler deploy
```

## Create via chat

Sidebar / empty state → `stashScheduleChatDraft()` → `/new?intent=schedule` prefills the composer; the model uses `create_scheduled_task`.
