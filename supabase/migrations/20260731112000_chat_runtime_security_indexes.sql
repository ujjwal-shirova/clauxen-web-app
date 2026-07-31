-- Harden the chat/scheduler runtime surfaced by the post-migration advisors.

create index if not exists scheduled_task_runs_chat_id_fk_idx
  on public.scheduled_task_runs (chat_id);

create index if not exists scheduled_tasks_last_chat_id_fk_idx
  on public.scheduled_tasks (last_chat_id);

drop policy if exists scheduled_tasks_own on public.scheduled_tasks;
create policy scheduled_tasks_own
  on public.scheduled_tasks
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists scheduled_task_runs_own on public.scheduled_task_runs;
create policy scheduled_task_runs_own
  on public.scheduled_task_runs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on function public.enqueue_chat_job(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.enqueue_chat_job(text, jsonb)
  to service_role;

revoke all on function public.gc_stale_streaming_messages(interval)
  from public, anon, authenticated;
grant execute on function public.gc_stale_streaming_messages(interval)
  to service_role;
