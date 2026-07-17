-- Background job queues for chat title, history warm, embeddings, streaming GC.
-- pgmq + pg_cron are already enabled on this project.

create extension if not exists pgmq;
create extension if not exists pg_cron;

do $$
begin
  perform pgmq.create('chat_title');
exception
  when duplicate_table then null;
  when others then
    if sqlerrm ilike '%already exists%' then null; else raise; end if;
end $$;

do $$
begin
  perform pgmq.create('history_warm');
exception
  when duplicate_table then null;
  when others then
    if sqlerrm ilike '%already exists%' then null; else raise; end if;
end $$;

do $$
begin
  perform pgmq.create('embed_ingest');
exception
  when duplicate_table then null;
  when others then
    if sqlerrm ilike '%already exists%' then null; else raise; end if;
end $$;

do $$
begin
  perform pgmq.create('streaming_gc');
exception
  when duplicate_table then null;
  when others then
    if sqlerrm ilike '%already exists%' then null; else raise; end if;
end $$;

create or replace function public.enqueue_chat_job(
  p_queue text,
  p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  v_msg_id bigint;
begin
  if p_queue not in ('chat_title', 'history_warm', 'embed_ingest', 'streaming_gc') then
    raise exception 'invalid queue %', p_queue;
  end if;
  select pgmq.send(p_queue, p_payload) into v_msg_id;
  return v_msg_id;
end;
$$;

revoke all on function public.enqueue_chat_job(text, jsonb) from public;
revoke execute on function public.enqueue_chat_job(text, jsonb) from authenticated;
grant execute on function public.enqueue_chat_job(text, jsonb) to service_role;

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
  with updated as (
    update public.chat_messages
    set
      status = 'complete',
      content = case
        when coalesce(trim(content), '') = '' then 'Generation interrupted.'
        else content
      end
    where role = 'assistant'
      and status = 'streaming'
      and created_at < now() - p_older_than
    returning id
  )
  select count(*)::integer into v_count from updated;
  return v_count;
end;
$$;

revoke all on function public.gc_stale_streaming_messages(interval) from public;
revoke execute on function public.gc_stale_streaming_messages(interval) from authenticated;
grant execute on function public.gc_stale_streaming_messages(interval) to service_role;

-- Covering index for sidebar starred + updated sort.
create index if not exists chats_user_starred_updated_idx
  on public.chats (user_id, starred desc nulls last, updated_at desc)
  where status != 'deleted';

do $$
begin
  execute 'alter role authenticated set statement_timeout = ''15s''';
exception
  when insufficient_privilege then null;
  when undefined_object then null;
end $$;
