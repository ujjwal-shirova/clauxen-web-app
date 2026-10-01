-- =============================================================================
-- Server-authoritative message tree branching.
--
-- Every chat_messages row becomes a node in a tree via parent_message_id.
-- Branches (edit & resend a user prompt, regenerate an assistant reply) insert
-- SIBLING nodes under the same parent instead of mutating rows. The visible
-- thread is one linear root->leaf path anchored by chats.active_leaf_message_id,
-- so a reload renders the exact active branch with zero client-side overlays.
--
-- Replaces the legacy client-owned chat_branch_states snapshot overlay:
-- branch content, sibling variants, and the "Thought for Ns" agent timeline
-- all live in chat_messages.content_json / metadata on the server.
-- =============================================================================

-- 1. Chain-link every legacy row so the whole history is one walkable tree.
--    Each message with a null parent gets the previous chronological message
--    in the same chat as its parent. Within one created_at (a single
--    beginChatTurn transaction) the user prompt precedes its assistant reply —
--    a bare id tiebreak inverts the pair and renders the user bubble below
--    its own answer.
with ordered as (
  select id,
         lag(id) over (
           partition by chat_id
           order by created_at,
                    case when role = 'user' then 0 else 1 end,
                    id
         ) as prev_id
  from public.chat_messages
)
update public.chat_messages m
set parent_message_id = o.prev_id
from ordered o
where o.id = m.id
  and m.parent_message_id is null
  and o.prev_id is not null;

-- 2. Active leaf pointer per chat — the end of the visible branch path.
alter table public.chats
  add column if not exists active_leaf_message_id uuid
  references public.chat_messages(id) on delete set null;

-- Backfill: newest message per chat becomes the active leaf. Within one
-- created_at the assistant reply is the end of the turn — pick it over the
-- prompt row of the same pair.
with newest as (
  select distinct on (chat_id) chat_id, id
  from public.chat_messages
  order by chat_id,
           created_at desc,
           case when role = 'user' then 0 else 1 end desc,
           id desc
)
update public.chats c
set active_leaf_message_id = n.id
from newest n
where c.id = n.chat_id
  and c.active_leaf_message_id is null;

create index if not exists chats_active_leaf_message_id_idx
  on public.chats (active_leaf_message_id)
  where active_leaf_message_id is not null;

-- Faster sibling lookups (variant counts + branch switches).
create index if not exists chat_messages_chat_parent_idx
  on public.chat_messages (chat_id, parent_message_id, created_at, id);

-- 3. Walkable page of the ACTIVE thread path (leaf -> root, paged by depth).
--    depth 0 = the leaf; higher depth = older ancestors. Each row carries
--    variant_index / variant_count so the client renders branch arrows
--    without any client-side version bookkeeping.
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
  v_max_depth bigint;
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
    -- max() must qualify window_page.depth: the unqualified name collides with
    -- this function's OUT-variable "depth" and raises 42702 (ambiguous column).
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

-- 4. Switch the visible branch at a fork point: activate a sibling and move
--    the leaf to the deepest previously-generated turn under it, so follow-ups
--    sent on that branch earlier are restored too.
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
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_leaf uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_target is null then
    raise exception 'target message required';
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

  if not exists (
    select 1 from public.chat_messages m
    where m.id = p_target and m.chat_id = p_chat_id
      and (m.status != 'cancelled' or coalesce(m.content, '') != '')
  ) then
    raise exception 'message not found';
  end if;

  -- Deepest descendant chain below the target; ties break on the newest.
  with recursive down as (
    select m.id, m.parent_message_id, 0::bigint as depth, m.created_at
    from public.chat_messages m
    where m.id = p_target
    union all
    select c.id, c.parent_message_id, down.depth + 1, c.created_at
    from public.chat_messages c
    join down on c.parent_message_id = down.id
    where c.status != 'cancelled' or coalesce(c.content, '') != ''
  )
  select id into v_leaf
  from down
  order by depth desc, created_at desc, id desc
  limit 1;

  update public.chats
  set active_leaf_message_id = v_leaf,
      updated_at = now()
  where id = p_chat_id and user_id = v_uid;

  return v_leaf;
end;
$$;

comment on function public.switch_chat_branch(text, uuid, uuid) is
  'Activate a sibling branch at a fork point and move the chat leaf to its deepest turn.';

revoke all on function public.switch_chat_branch(text, uuid, uuid) from public;
grant execute on function public.switch_chat_branch(text, uuid, uuid) to authenticated;
grant execute on function public.switch_chat_branch(text, uuid, uuid) to service_role;

-- 5. Retire the client-owned branch snapshot overlay.
do $$ begin
  alter publication supabase_realtime drop table public.chat_branch_states;
exception when others then null;
end $$;

drop table if exists public.chat_branch_states;