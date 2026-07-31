-- Make message-linked transcript lines idempotent so HTTP/stream retries can
-- safely repair a partially persisted turn without duplicating training data.

-- Preserve the earliest chronological slot for any existing duplicate while
-- keeping the newest payload/timestamps captured for that logical line.
with duplicate_groups as (
  select message_id, role
  from public.chat_transcript_lines
  where message_id is not null
  group by message_id, role
  having count(*) > 1
),
keepers as (
  select distinct on (t.message_id, t.role)
    t.message_id,
    t.role,
    t.id as keep_id
  from public.chat_transcript_lines t
  join duplicate_groups d
    on d.message_id = t.message_id and d.role = t.role
  order by t.message_id, t.role, t.seq asc, t.id asc
),
latest as (
  select distinct on (t.message_id, t.role)
    t.message_id,
    t.role,
    t.record,
    t.schema_version,
    t.training_eligible,
    t.created_at
  from public.chat_transcript_lines t
  join duplicate_groups d
    on d.message_id = t.message_id and d.role = t.role
  order by t.message_id, t.role, t.seq desc, t.id desc
)
update public.chat_transcript_lines target
set
  record = latest.record,
  schema_version = latest.schema_version,
  training_eligible = latest.training_eligible,
  created_at = latest.created_at
from keepers
join latest
  on latest.message_id = keepers.message_id and latest.role = keepers.role
where target.id = keepers.keep_id;

with ranked as (
  select
    id,
    row_number() over (
      partition by message_id, role
      order by seq asc, id asc
    ) as duplicate_number
  from public.chat_transcript_lines
  where message_id is not null
)
delete from public.chat_transcript_lines target
using ranked
where target.id = ranked.id
  and ranked.duplicate_number > 1;

create unique index if not exists chat_transcript_lines_message_role_unique_idx
  on public.chat_transcript_lines (message_id, role)
  where message_id is not null;

-- Keep provider/tool stream ids so the normalized tool_calls table can be
-- repaired idempotently beside the assistant transcript transaction.
alter table public.tool_calls
  add column if not exists provider_call_id text;

create unique index if not exists tool_calls_message_provider_call_unique_idx
  on public.tool_calls (message_id, provider_call_id)
  where message_id is not null and provider_call_id is not null;

-- Existing callers use this RPC. Make it retry-safe as well: a repeated
-- logical line updates the durable payload in place instead of allocating a
-- second sequence number.
create or replace function public.append_chat_transcript_line(
  p_chat_id text,
  p_user_id uuid,
  p_message_id uuid,
  p_role text,
  p_record jsonb,
  p_schema_version text default 'clauxen.transcript.v1',
  p_training_eligible boolean default true
)
returns public.chat_transcript_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  next_seq integer;
  inserted public.chat_transcript_lines;
begin
  if not exists (
    select 1 from public.chats
    where id = p_chat_id and user_id = p_user_id and status != 'deleted'
  ) then
    raise exception 'chat not found or not owned by user';
  end if;

  if p_role not in ('user', 'assistant', 'system', 'tool', 'meta') then
    raise exception 'invalid transcript role';
  end if;

  perform 1 from public.chats where id = p_chat_id for update;

  if p_message_id is not null then
    update public.chat_transcript_lines
    set
      record = p_record,
      schema_version = coalesce(
        nullif(p_schema_version, ''),
        'clauxen.transcript.v1'
      ),
      training_eligible = coalesce(p_training_eligible, true)
    where message_id = p_message_id and role = p_role
    returning * into inserted;

    if inserted.id is not null then
      return inserted;
    end if;
  end if;

  select coalesce(max(seq), 0) + 1
    into next_seq
  from public.chat_transcript_lines
  where chat_id = p_chat_id;

  insert into public.chat_transcript_lines (
    chat_id, user_id, message_id, seq, role, record, schema_version,
    training_eligible
  ) values (
    p_chat_id,
    p_user_id,
    p_message_id,
    next_seq,
    p_role,
    p_record,
    coalesce(nullif(p_schema_version, ''), 'clauxen.transcript.v1'),
    coalesce(p_training_eligible, true)
  )
  on conflict (message_id, role) where message_id is not null
  do update set
    record = excluded.record,
    schema_version = excluded.schema_version,
    training_eligible = excluded.training_eligible
  returning * into inserted;

  return inserted;
end;
$$;

revoke all on function public.append_chat_transcript_line(
  text, uuid, uuid, text, jsonb, text, boolean
) from public;
grant execute on function public.append_chat_transcript_line(
  text, uuid, uuid, text, jsonb, text, boolean
) to service_role;
