create index if not exists automation_notifications_task_id_fk_idx
  on public.automation_notifications (task_id);

create index if not exists scheduled_tasks_lease_run_id_fk_idx
  on public.scheduled_tasks (lease_run_id)
  where lease_run_id is not null;

create index if not exists scheduled_tasks_project_id_fk_idx
  on public.scheduled_tasks (project_id)
  where project_id is not null;
