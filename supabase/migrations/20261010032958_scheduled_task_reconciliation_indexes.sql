-- Keep every-minute reconciliation proportional to pending work, not history.
create index if not exists scheduled_task_runs_notification_pending_idx
  on public.scheduled_task_runs (finished_at)
  where status in ('success', 'failed', 'skipped')
    and metadata->>'notification_pending' = 'true';

create index if not exists scheduled_task_runs_reconcile_idx
  on public.scheduled_task_runs (started_at, chat_id)
  where status = 'running';
