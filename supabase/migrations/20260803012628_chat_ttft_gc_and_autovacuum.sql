-- TTFT hygiene: cheaper stale-stream GC + keep chats/chat_messages vacuumed.
-- Root cause: gc_stale_streaming_messages mean ~375ms scanning a broad
-- active_stream partial index; chats had ~85% dead tuples with no autovacuum.

create index if not exists chat_messages_stale_streaming_gc_idx
  on public.chat_messages (created_at)
  where role = 'assistant' and status = 'streaming';

create or replace function public.gc_stale_streaming_messages(
  p_older_than interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Batch so a quiet table stays cheap and a backlog cannot lock forever.
  with candidates as (
    select id
    from public.chat_messages
    where role = 'assistant'
      and status = 'streaming'
      and created_at < now() - p_older_than
    order by created_at asc
    limit 500
  ),
  updated as (
    update public.chat_messages m
    set
      status = 'complete',
      content = case
        when coalesce(trim(m.content), '') = '' then 'Generation interrupted.'
        else m.content
      end,
      updated_at = now()
    from candidates c
    where m.id = c.id
    returning m.id
  )
  select count(*)::integer into v_count from updated;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.gc_stale_streaming_messages(interval) from public;
revoke all on function public.gc_stale_streaming_messages(interval) from anon, authenticated;
grant execute on function public.gc_stale_streaming_messages(interval) to service_role;

alter table public.chats set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 25,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 25
);

alter table public.chat_messages set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_analyze_threshold = 50
);
