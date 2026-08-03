-- Return stable browser idempotency keys on every hydrate. Without client_id,
-- optimistic rows cannot be reconciled after a reload or a queued retry.

drop function if exists public.fetch_chat_messages_page(
  text, uuid, timestamptz, uuid, int
);

create function public.fetch_chat_messages_page(
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
  client_id text,
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
      m.created_at,
      m.client_id
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
    p.client_id,
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

comment on function public.fetch_chat_messages_page(
  text, uuid, timestamptz, uuid, int
) is 'Source-consistent keyset page with stable client idempotency keys.';

revoke all on function public.fetch_chat_messages_page(
  text, uuid, timestamptz, uuid, int
) from public;
revoke execute on function public.fetch_chat_messages_page(
  text, uuid, timestamptz, uuid, int
) from authenticated;
grant execute on function public.fetch_chat_messages_page(
  text, uuid, timestamptz, uuid, int
) to service_role;
