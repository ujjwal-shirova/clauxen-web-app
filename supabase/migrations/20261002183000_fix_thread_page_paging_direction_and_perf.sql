-- =============================================================================
-- Fix: fetch_chat_thread_page paged the WRONG END of the thread and could
-- never continue past the first page, so chats never fully loaded.
--
-- Depth convention (unchanged): depth = hops from the ACTIVE LEAF.
--   0 = newest node of the active path, larger = older ancestors (root last).
--
-- Under that convention the previous body had three inverted clauses:
--   1. window_page selected `order by p.depth desc limit` -> the OLDEST N
--      nodes (root side) instead of the newest N.
--   2. `has_more` looked for rows deeper than the page's MAX depth -- which is
--      the root itself on the first page -- so has_more was ALWAYS false and
--      the client stopped after one page. Every message past the hydrate
--      window (80 for free plans) silently never loaded.
--   3. Output `order by w.depth asc` returned newest->oldest (reverse
--      chronological). Equal created_at rows (user + assistant share a
--      transaction timestamp) then rendered with the user bubble BELOW its
--      own answer -- the "disordered chat history" bug.
--
-- Corrected contract (matches the client cursor code unchanged -- it always
-- sends nextCursor.depth = max(depth) of the returned page):
--   * window_page: nearest-to-leaf nodes first  -> newest N of the path.
--   * cursor: p.depth > p_depth_cursor          -> strictly OLDER batches.
--   * output: order by w.depth desc             -> chronological ASC
--     (root -> leaf), user prompt precedes its assistant reply.
--   * has_more: renderable rows with depth > max(page depth) -> true while
--     older ancestors remain (now correct with the newest-first window).
--
-- Perf: the `siblings` CTE previously window-ranked EVERY row of the chat on
-- EVERY page read. It is now restricted to sibling groups that actually
-- intersect the returned page (identical variant_index/variant_count values,
-- since partitions are unchanged) and can use chat_messages_chat_parent_idx.
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
  -- Newest N renderable nodes of the active path (depth asc = leaf outwards).
  -- Depth keys are stable per active leaf, so keyset pages never mix rows.
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
  -- Sibling groups that intersect the page -- variant_index/variant_count are
  -- identical to ranking the whole chat (same partitions), but the window
  -- sort now touches only the rows the caller can see.
  page_parents as (
    select distinct wm.parent_message_id as pid
    from window_page w
    join public.chat_messages wm on wm.id = w.id
  ),
  siblings as (
    select ranked.id, ranked.variant_index, ranked.variant_count
    from (
      select m.id,
             row_number() over (
               partition by m.parent_message_id
               order by m.created_at, m.id
             )::int as variant_index,
             count(*) over (partition by m.parent_message_id)::int as variant_count
      from public.chat_messages m
      where m.chat_id = p_chat_id
        and m.parent_message_id in (
          select pp.pid from page_parents pp where pp.pid is not null
        )
    ) ranked
    union all
    select ranked.id, ranked.variant_index, ranked.variant_count
    from (
      select m.id,
             row_number() over (
               partition by m.parent_message_id
               order by m.created_at, m.id
             )::int as variant_index,
             count(*) over (partition by m.parent_message_id)::int as variant_count
      from public.chat_messages m
      where m.chat_id = p_chat_id
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
    coalesce(m.metadata, '{}'::jsonb) as metadata,
    coalesce(m.content_json, '{}'::jsonb) as content_json,
    m.created_at,
    m.client_id,
    m.parent_message_id,
    w.depth,
    coalesce(s.variant_index, 1),
    coalesce(s.variant_count, 1),
    -- has_more: renderable ancestors older than this page's oldest row.
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
  order by w.depth desc; -- chronological ASC (root -> leaf)
end;
$$;

comment on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) is
  'Active branch path of a chat (root->leaf), depth-paged newest-first: depth 0 = active leaf, larger = older; p_depth_cursor is exclusive -- pass max(depth) of the previous page for older batches. Rows carry variant_index/variant_count for branch arrows.';

revoke all on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) from public;
grant execute on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) to authenticated;
grant execute on function public.fetch_chat_thread_page(text, uuid, uuid, bigint, int) to service_role;
