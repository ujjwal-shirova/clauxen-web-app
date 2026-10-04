-- =============================================================================
-- Migration: 20261004221000_chat_branch_persistence_and_perspective.sql
-- Description: Chat message tree branching with active perspective memory,
--              sibling navigation (prev/next/index/target), and instant
--              cross-device sync in Supabase.
-- =============================================================================

-- 1. Enhanced fetch_chat_thread_page:
--    Returns 0-based variant_index, total variant_count, and injects
--    sibling_ids array and sibling_variants into metadata so clients on any
--    device immediately have the full variant tree for instantaneous branch switching.

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
  -- Newest N renderable nodes of the active path (depth asc = leaf outwards).
  window_page as (
    select p.id, p.depth
    from path p
    join public.chat_messages m2 on m2.id = p.id
    where m2.chat_id = p_chat_id
      and (m2.status != 'cancelled' or coalesce(m2.content, '') != '')
      and (p_depth_cursor is null or p.depth > p_depth_cursor)
    order by p.depth asc
    limit v_limit
  ),
  page_parents as (
    select distinct wm.parent_message_id as pid
    from window_page w
    join public.chat_messages wm on wm.id = w.id
  ),
  siblings as (
    select
      ranked.id,
      ranked.variant_index,
      ranked.variant_count,
      ranked.sibling_ids,
      ranked.sibling_variants
    from (
      select
        m.id,
        (row_number() over (
          partition by m.parent_message_id
          order by m.created_at, m.id
        ) - 1)::int as variant_index,
        count(*) over (partition by m.parent_message_id)::int as variant_count,
        array_agg(m.id) over (
          partition by m.parent_message_id
          order by m.created_at, m.id
          range between unbounded preceding and unbounded following
        ) as sibling_ids,
        jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'index', (row_number() over (
              partition by m.parent_message_id
              order by m.created_at, m.id
            ) - 1)::int,
            'content', coalesce(m.content, '')
          )
        ) over (
          partition by m.parent_message_id
          order by m.created_at, m.id
          range between unbounded preceding and unbounded following
        ) as sibling_variants
      from public.chat_messages m
      where m.chat_id = p_chat_id
        and (m.status != 'cancelled' or coalesce(m.content, '') != '')
        and m.parent_message_id in (
          select pp.pid from page_parents pp where pp.pid is not null
        )
    ) ranked
    union all
    select
      ranked.id,
      ranked.variant_index,
      ranked.variant_count,
      ranked.sibling_ids,
      ranked.sibling_variants
    from (
      select
        m.id,
        (row_number() over (
          partition by m.parent_message_id
          order by m.created_at, m.id
        ) - 1)::int as variant_index,
        count(*) over (partition by m.parent_message_id)::int as variant_count,
        array_agg(m.id) over (
          partition by m.parent_message_id
          order by m.created_at, m.id
          range between unbounded preceding and unbounded following
        ) as sibling_ids,
        jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'index', (row_number() over (
              partition by m.parent_message_id
              order by m.created_at, m.id
            ) - 1)::int,
            'content', coalesce(m.content, '')
          )
        ) over (
          partition by m.parent_message_id
          order by m.created_at, m.id
          range between unbounded preceding and unbounded following
        ) as sibling_variants
      from public.chat_messages m
      where m.chat_id = p_chat_id
        and (m.status != 'cancelled' or coalesce(m.content, '') != '')
        and m.parent_message_id is null
        and exists (select 1 from page_parents pp where pp.pid is null)
    ) ranked
  )
  select
    m.id,
    m.chat_id::text,
    m.role,
    coalesce(m.content, '') as content,
    m.status,
    coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object(
      'sibling_ids', coalesce(s.sibling_ids, array[m.id]),
      'sibling_variants', coalesce(s.sibling_variants, jsonb_build_array(jsonb_build_object('id', m.id, 'index', 0, 'content', coalesce(m.content, ''))))
    ) as metadata,
    coalesce(m.content_json, '{}'::jsonb) as content_json,
    m.created_at,
    m.client_id,
    m.parent_message_id,
    w.depth,
    coalesce(s.variant_index, 0),
    coalesce(s.variant_count, 1),
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
  order by w.depth desc;
end;
$$;

revoke all on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) from public;
grant execute on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) to authenticated;
grant execute on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) to service_role;


-- 2. Enhanced switch_chat_branch:
--    Supports target message, direction ('prev' / 'next'), target index (0-based),
--    or target sibling message id. Tracks active child perspective per fork
--    node in chats.metadata->'active_children' and updates chats.active_leaf_message_id.

create or replace function public.switch_chat_branch(
  p_chat_id text,
  p_user_id uuid default null,
  p_target uuid default null,
  p_direction text default null,
  p_target_index int default null,
  p_target_message_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_chat_metadata jsonb;
  v_active_children jsonb;
  v_target_msg record;
  v_siblings uuid[];
  v_curr_idx int;
  v_target_sibling uuid;
  v_curr uuid;
  v_next_child uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select metadata into v_chat_metadata
  from public.chats
  where id = p_chat_id and user_id = v_uid and status != 'deleted';

  if not found then
    raise exception 'chat not found';
  end if;

  v_active_children := coalesce(v_chat_metadata->'active_children', '{}'::jsonb);

  if p_target_message_id is not null then
    v_target_sibling := p_target_message_id;
  elsif p_target is not null then
    select id, parent_message_id into v_target_msg
    from public.chat_messages
    where id = p_target and chat_id = p_chat_id
      and (status != 'cancelled' or coalesce(content, '') != '');

    if not found then
      raise exception 'message not found';
    end if;

    if p_direction is not null or p_target_index is not null then
      select array_agg(id order by created_at asc, id asc) into v_siblings
      from public.chat_messages
      where chat_id = p_chat_id
        and parent_message_id is not distinct from v_target_msg.parent_message_id
        and (status != 'cancelled' or coalesce(content, '') != '');

      v_curr_idx := array_position(v_siblings, v_target_msg.id);

      if p_target_index is not null then
        v_target_sibling := v_siblings[p_target_index + 1];
      elsif p_direction = 'prev' then
        v_target_sibling := v_siblings[greatest(1, coalesce(v_curr_idx, 1) - 1)];
      elsif p_direction = 'next' then
        v_target_sibling := v_siblings[least(coalesce(cardinality(v_siblings), 1), coalesce(v_curr_idx, 1) + 1)];
      else
        v_target_sibling := v_target_msg.id;
      end if;

      if v_target_sibling is null then
        v_target_sibling := v_target_msg.id;
      end if;
    else
      v_target_sibling := v_target_msg.id;
    end if;
  else
    raise exception 'target message required';
  end if;

  select id, parent_message_id into v_target_msg
  from public.chat_messages
  where id = v_target_sibling and chat_id = p_chat_id
    and (status != 'cancelled' or coalesce(content, '') != '');

  if not found then
    raise exception 'target sibling not found';
  end if;

  v_active_children := jsonb_set(
    v_active_children,
    array[coalesce(v_target_msg.parent_message_id::text, 'root')],
    to_jsonb(v_target_msg.id::text)
  );

  v_curr := v_target_sibling;
  for i in 1..500 loop
    v_next_child := null;

    if v_active_children ? v_curr::text then
      select id into v_next_child
      from public.chat_messages
      where id = (v_active_children->>v_curr::text)::uuid
        and chat_id = p_chat_id
        and parent_message_id = v_curr
        and (status != 'cancelled' or coalesce(content, '') != '');
    end if;

    if v_next_child is null then
      select id into v_next_child
      from public.chat_messages
      where chat_id = p_chat_id
        and parent_message_id = v_curr
        and (status != 'cancelled' or coalesce(content, '') != '')
      order by created_at desc, id desc
      limit 1;
    end if;

    if v_next_child is not null then
      v_active_children := jsonb_set(
        v_active_children,
        array[v_curr::text],
        to_jsonb(v_next_child::text)
      );
      v_curr := v_next_child;
    else
      exit;
    end if;
  end loop;

  update public.chats
  set active_leaf_message_id = v_curr,
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{active_children}',
        v_active_children
      ),
      updated_at = now()
  where id = p_chat_id and user_id = v_uid;

  return v_curr;
end;
$$;

revoke all on function public.switch_chat_branch(text, uuid, uuid, text, int, uuid) from public;
grant execute on function public.switch_chat_branch(text, uuid, uuid, text, int, uuid) to authenticated;
grant execute on function public.switch_chat_branch(text, uuid, uuid, text, int, uuid) to service_role;

-- 3. Overloaded 3-arg switch_chat_branch compatibility wrapper:
create or replace function public.switch_chat_branch(
  p_chat_id text,
  p_user_id uuid default null,
  p_target uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.switch_chat_branch(p_chat_id, p_user_id, p_target, null, null, null);
end;
$$;

revoke all on function public.switch_chat_branch(text, uuid, uuid) from public;
grant execute on function public.switch_chat_branch(text, uuid, uuid) to authenticated;
grant execute on function public.switch_chat_branch(text, uuid, uuid) to service_role;

-- 4. Backfill active_children for existing chats based on their active leaf path.
with recursive path as (
  select c.id as chat_id, m.id as msg_id, m.parent_message_id
  from public.chats c
  join public.chat_messages m on m.id = c.active_leaf_message_id
  where c.active_leaf_message_id is not null
  union all
  select p.chat_id, m2.id, m2.parent_message_id
  from public.chat_messages m2
  join path p on p.parent_message_id = m2.id
),
aggregated as (
  select
    chat_id,
    jsonb_object_agg(coalesce(parent_message_id::text, 'root'), msg_id::text) as active_children
  from path
  group by chat_id
)
update public.chats c
set metadata = jsonb_set(
  coalesce(c.metadata, '{}'::jsonb),
  '{active_children}',
  a.active_children
)
from aggregated a
where c.id = a.chat_id
  and (c.metadata->'active_children' is null or c.metadata->'active_children' = '{}'::jsonb);
