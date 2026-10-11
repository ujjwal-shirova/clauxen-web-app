create table public.deep_research_plans (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_call_id text not null check (length(tool_call_id) between 1 and 200),
  title text not null check (length(title) between 1 and 200),
  tasks jsonb not null check (jsonb_typeof(tasks)='array' and jsonb_array_length(tasks) between 3 and 8),
  task_statuses jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','editing','starting','running','paused','complete','failed','cancelled')),
  auto_start_at timestamptz,
  execution_origin text not null,
  model text,
  job_id uuid references public.chat_generation_jobs(id) on delete set null,
  source_urls text[] not null default '{}',
  search_count integer not null default 0 check (search_count >= 0),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(chat_id,tool_call_id)
);
create index deep_research_owner_chat_idx on public.deep_research_plans(user_id,chat_id);
create index deep_research_due_idx on public.deep_research_plans(auto_start_at) where status='pending';
create index deep_research_starting_idx on public.deep_research_plans(updated_at) where status='starting';
create index deep_research_job_idx on public.deep_research_plans(job_id) where job_id is not null;
alter table public.deep_research_plans enable row level security;
grant select on public.deep_research_plans to authenticated;
revoke insert,update,delete on public.deep_research_plans from anon,authenticated;
create policy deep_research_owner_read on public.deep_research_plans for select to authenticated using (user_id=(select auth.uid()));
