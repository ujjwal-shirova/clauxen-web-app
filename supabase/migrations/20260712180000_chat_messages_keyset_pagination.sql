-- Keyset pagination for chat history (Cursor-style).
-- Composite cursor (created_at, id) because message ids are UUID v4 (not time-ordered).

create index if not exists chat_messages_chat_created_id_desc_idx
  on public.chat_messages (chat_id, created_at desc, id desc)
  where status != 'cancelled';

-- Realtime UPDATE payloads for streaming status/content patches.
do $$ begin
  alter table public.chat_messages replica identity full;
exception when others then null;
end $$;

/**
 * Fetch a page of chat messages older than an optional composite cursor.
 * Returns rows in chronological ASC order for the client.
 * has_more is true when older rows exist beyond this page's oldest message.
 *
 * SECURITY DEFINER with ownership guard (matches other chat RPCs).
 * Callable from service-role pool or authenticated clients.
 */
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
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
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

comment on function public.fetch_chat_messages_page(text, uuid, timestamptz, uuid, int) is
  'Keyset page of chat_messages for a owned chat; composite cursor (created_at, id).';

revoke all on function public.fetch_chat_messages_page(text, uuid, timestamptz, uuid, int) from public;
grant execute on function public.fetch_chat_messages_page(text, uuid, timestamptz, uuid, int) to authenticated;
grant execute on function public.fetch_chat_messages_page(text, uuid, timestamptz, uuid, int) to service_role;
