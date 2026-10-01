-- =============================================================================
-- Fix: legacy turn pairs chained assistant-before-user.
--
-- beginChatTurn commits the user prompt and its assistant reply in ONE
-- transaction, so both rows share the same created_at. The tree backfill in
-- 20260930220000 chained rows with `order by created_at, id`; on equal
-- timestamps the id tiebreak is arbitrary, so every same-transaction pair
-- (180/180 at apply time) was chained assistant-first — inverting the visible
-- thread: the user bubble renders AFTER its own assistant reply, or two
-- assistant replies render adjacent with the user prompt displaced below.
--
-- Correct order within one created_at: the user prompt precedes its reply.
--
-- Guarded: only rows whose current parent equals the old buggy backfill
-- parent (lag over created_at, id) are re-chained, so branch trees created by
-- the new fork inserts (edit / regenerate siblings) are never flattened.
-- Idempotent: a second run finds parent = fixed_prev everywhere and no-ops.
-- =============================================================================

with buggy as (
  select id,
         lag(id) over (partition by chat_id order by created_at, id) as buggy_prev
  from public.chat_messages
),
fixed as (
  select id,
         lag(id) over (
           partition by chat_id
           order by created_at,
                    case when role = 'user' then 0 else 1 end,
                    id
         ) as fixed_prev
  from public.chat_messages
)
update public.chat_messages m
set parent_message_id = f.fixed_prev
from buggy b
join fixed f on f.id = b.id
where m.id = b.id
  and b.buggy_prev is not distinct from m.parent_message_id
  and f.fixed_prev is distinct from m.parent_message_id;

-- 2. Leaf repair: the original backfill also picked the leaf per chat with a
--    bare (created_at desc, id desc) tiebreak, so for same-timestamp pairs it
--    could point at the USER prompt — and the leaf->root walk then excludes
--    the pair's assistant reply entirely (the answer renders missing). Within
--    one created_at the assistant reply is the end of the turn: pick it.
update public.chats c
set active_leaf_message_id = (
  select m.id
  from public.chat_messages m
  where m.chat_id = c.id
  order by m.created_at desc,
           case when m.role = 'user' then 0 else 1 end desc,
           m.id desc
  limit 1
)
where exists (select 1 from public.chat_messages m2 where m2.chat_id = c.id);
