-- Durable chat-turn integrity:
-- - idempotent client retries per chat
-- - full-thread hydrate bound aligned with the application
-- - private service-only chat RPC surface
-- - current transcript schema default

alter table public.chat_messages
  add column if not exists client_id text;

create unique index if not exists chat_messages_chat_client_id_unique_idx
  on public.chat_messages (chat_id, client_id)
  where client_id is not null;

comment on column public.chat_messages.client_id is
  'Stable client-generated idempotency key for an optimistic chat message.';

create or replace function public.fetch_chat_messages_page(
  p_chat_id text,
  p_user_id uuid default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit int default 20
)
returns table (
  id uuid,
  chat_id text,
  role text,
  content text,
  status text,
  metadata jsonb,
  content_json jsonb,
  created_at timestamptz,
  has_more boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 500));
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.chats c
    where c.id = p_chat_id
      and c.user_id = v_uid
      and c.status != 'deleted'
  ) then
    raise exception 'chat not found';
  end if;

  return query
  with page as (
    select
      m.id,
      m.chat_id,
      m.role,
      coalesce(m.content, '') as content,
      m.status,
      coalesce(m.metadata, '{}'::jsonb) as metadata,
      coalesce(m.content_json, '{}'::jsonb) as content_json,
      m.created_at
    from public.chat_messages m
    where m.chat_id = p_chat_id
      and m.status != 'cancelled'
      and (
        p_cursor_created_at is null
        or p_cursor_id is null
        or (m.created_at, m.id) < (p_cursor_created_at, p_cursor_id)
      )
    order by m.created_at desc, m.id desc
    limit v_limit
  ),
  bounds as (
    select p.created_at as oldest_created_at, p.id as oldest_id
    from page p
    order by p.created_at asc, p.id asc
    limit 1
  )
  select
    p.id,
    p.chat_id,
    p.role,
    p.content,
    p.status,
    p.metadata,
    p.content_json,
    p.created_at,
    exists (
      select 1
      from public.chat_messages older
      cross join bounds b
      where older.chat_id = p_chat_id
        and older.status != 'cancelled'
        and (older.created_at, older.id) < (b.oldest_created_at, b.oldest_id)
    ) as has_more
  from page p
  order by p.created_at asc, p.id asc;
end;
$$;

revoke all on function public.fetch_chat_messages_page(text, uuid, timestamptz, uuid, int)
  from public;
revoke execute on function public.fetch_chat_messages_page(text, uuid, timestamptz, uuid, int)
  from authenticated;
grant execute on function public.fetch_chat_messages_page(text, uuid, timestamptz, uuid, int)
  to service_role;

revoke all on function public.append_chat_message(
  text, text, text, jsonb, uuid, uuid, text, integer, integer
) from public;
revoke execute on function public.append_chat_message(
  text, text, text, jsonb, uuid, uuid, text, integer, integer
) from authenticated;
grant execute on function public.append_chat_message(
  text, text, text, jsonb, uuid, uuid, text, integer, integer
) to service_role;

alter table public.chat_transcript_lines
  alter column schema_version
  set default 'clauxen.transcript.anthropic.v1';
