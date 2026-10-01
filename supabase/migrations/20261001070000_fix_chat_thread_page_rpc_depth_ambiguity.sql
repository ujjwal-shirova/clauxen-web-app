-- =============================================================================
-- Fix: fetch_chat_thread_page raised 42702 (ambiguous column "depth").
--
-- The has_more subquery used an unqualified max(depth) that collided with the
-- PL/pgSQL OUT-variable "depth" declared by `returns table (... depth ...)`,
-- so every thread-page read (chat load + Cloudflare worker hydrate) failed
-- with "column reference "depth" is ambiguous" and sends surfaced as
-- "Something unexpected happened. Please try again."
--
-- Idempotent: create or replace with the qualified max(window_page.depth).
-- Fresh environments that already applied the fixed 20260930220000 body
-- re-run this as a no-op replacement.
-- =============================================================================

create or replace function public.fetch_chat_thread_page(
  p_chat_id text,
  p_user_id uuid default null,
  p_leaf uuid default null,
  p_depth_cursor bigint default null,
  p_limit int default 500
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
  parent_message_id uuid,
  depth bigint,
  variant_index int,
  variant_count int,
  has_more boolean,
  next_depth bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_limit int := greatest(1, least(coalesce(p_limit, 500), 500));
  v_leaf uuid;
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

  -- Leaf resolution: explicit leaf must belong to this chat; otherwise fall
  -- back to the chat's stored leaf, then to the newest message (legacy rows).
  if p_leaf is not null then
    select m.id into v_leaf
    from public.chat_messages m
    where m.id = p_leaf and m.chat_id = p_chat_id;
    if v_leaf is null then
      raise exception 'chat not found';
    end if;
  else
    select c.active_leaf_message_id into v_leaf
    from public.chats c
    where c.id = p_chat_id;
  end if;

  if v_leaf is null then
    select m.id into v_leaf
    from public.chat_messages m
    where m.chat_id = p_chat_id
    order by m.created_at desc, m.id desc
    limit 1;
  end if;

  if v_leaf is null then
    return; -- empty chat
  end if;

  return query
  with recursive path as (
    select m.id, m.parent_message_id, 0::bigint as depth
    from public.chat_messages m
    where m.id = v_leaf
    union all
    select p.id, p.parent_message_id, path.depth + 1
    from public.chat_messages p
    join path on p.id = path.parent_message_id
  ),
  -- Rank every sibling group once so variant counts cover non-active
  -- branches too (the arrows stay truthful across switches).
  siblings as (
    select m.id,
           row_number() over (
             partition by m.parent_message_id
             order by m.created_at, m.id
           )::int as variant_index,
           count(*) over (partition by m.parent_message_id)::int as variant_count
    from public.chat_messages m
    where m.chat_id = p_chat_id
  ),
  window_page as (
    select p.id, p.depth
    from path p
    join public.chat_messages m2 on m2.id = p.id
    where m2.chat_id = p_chat_id
      and (m2.status != 'cancelled' or coalesce(m2.content, '') != '')
      and (p_depth_cursor is null or p.depth < p_depth_cursor)
    order by p.depth desc
    limit v_limit
  )
  select
    m.id,
    m.chat_id::text,
    m.role,
    coalesce(m.content, '') as content,
    m.status,
    coalesce(m.metadata, '{}'::jsonb) as metadata,
    coalesce(m.content_json, '{}'::jsonb) as content_json,
    m.created_at,
    m.client_id,
    m.parent_message_id,
    w.depth,
    coalesce(s.variant_index, 1),
    coalesce(s.variant_count, 1),
    -- has_more: renderable ancestors older than this page's deepest row.
    -- max() must qualify window_page.depth: the unqualified name collides
    -- with this function's OUT-variable "depth" and raises 42702.
    exists (
      select 1
      from path older
      join public.chat_messages mo on mo.id = older.id
      where mo.chat_id = p_chat_id
        and (mo.status != 'cancelled' or coalesce(mo.content, '') != '')
        and older.depth > (select coalesce(max(window_page.depth), -1) from window_page)
    ) as has_more,
    w.depth as next_depth
  from window_page w
  join public.chat_messages m on m.id = w.id
  left join siblings s on s.id = m.id
  order by w.depth asc; -- chronological ASC (root -> leaf)
end;
$$;

comment on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) is
  'Active branch path of a chat (root->leaf), depth-paged; rows carry variant_index/variant_count for branch arrows.';

revoke all on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) from public;
grant execute on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) to authenticated;
grant execute on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) to service_role;
