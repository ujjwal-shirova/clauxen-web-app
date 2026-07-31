-- Rebuild the derived JSONL transcript from the canonical structured message
-- payloads so historical chats also have complete, chronological training data.
-- Preserve a chat's existing training opt-out if any prior line opted out.

create temporary table chat_transcript_rebuild_flags on commit drop as
select
  c.id as chat_id,
  c.user_id,
  coalesce(bool_and(t.training_eligible), true) as training_eligible
from public.chats c
left join public.chat_transcript_lines t on t.chat_id = c.id
where c.status != 'deleted'
group by c.id, c.user_id;

delete from public.chat_transcript_lines
where chat_id in (select chat_id from chat_transcript_rebuild_flags);

with base_records as (
  select
    m.chat_id,
    m.user_id,
    m.id as message_id,
    m.created_at,
    0 as part_order,
    case
      when m.role in ('user', 'assistant', 'system', 'tool') then m.role
      else 'system'
    end as role,
    case
      when jsonb_typeof(m.content_json->'message'->'content') = 'array'
        then m.content_json
      else jsonb_build_object(
        'role', case
          when m.role in ('user', 'assistant', 'system', 'tool') then m.role
          else 'system'
        end,
        'message', jsonb_build_object(
          'content', jsonb_build_array(
            jsonb_build_object('type', 'text', 'text', coalesce(m.content, ''))
          )
        )
      )
    end as record
  from public.chat_messages m
  join chat_transcript_rebuild_flags f
    on f.chat_id = m.chat_id and f.user_id = m.user_id
  where m.role != 'assistant' or m.status != 'streaming'
),
tool_result_records as (
  select
    m.chat_id,
    m.user_id,
    m.id as message_id,
    m.created_at,
    1 as part_order,
    'user'::text as role,
    jsonb_build_object(
      'role', 'user',
      'message', jsonb_build_object('content', tool_results.content)
    ) as record
  from public.chat_messages m
  join chat_transcript_rebuild_flags f
    on f.chat_id = m.chat_id and f.user_id = m.user_id
  cross join lateral (
    select jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'type', 'tool_result',
          'tool_use_id', action.value->>'id',
          'content', coalesce(action.value->>'result', ''),
          'is_error', case
            when coalesce((action.value->>'isError')::boolean, false) then true
            else null
          end
        )
      )
      order by action.ordinality
    ) as content
    from jsonb_array_elements(
      case
        when jsonb_typeof(m.content_json->'agent_ui'->'actions') = 'array'
          then m.content_json->'agent_ui'->'actions'
        else '[]'::jsonb
      end
    ) with ordinality as action(value, ordinality)
    where action.value ? 'result'
      and nullif(action.value->>'id', '') is not null
  ) tool_results
  where m.role = 'assistant'
    and m.status != 'streaming'
    and tool_results.content is not null
),
terminal_records as (
  select
    m.chat_id,
    m.user_id,
    m.id as message_id,
    m.created_at,
    2 as part_order,
    'meta'::text as role,
    jsonb_build_object(
      'type', 'turn_ended',
      'status', case
        when m.status = 'complete' then 'success'
        when m.status = 'cancelled' then 'cancelled'
        else 'error'
      end
    ) as record
  from public.chat_messages m
  join chat_transcript_rebuild_flags f
    on f.chat_id = m.chat_id and f.user_id = m.user_id
  where m.role = 'assistant' and m.status != 'streaming'
),
all_records as (
  select * from base_records
  union all
  select * from tool_result_records
  union all
  select * from terminal_records
),
sequenced as (
  select
    r.*,
    row_number() over (
      partition by r.chat_id
      order by r.created_at asc, r.message_id asc, r.part_order asc
    )::integer as seq
  from all_records r
)
insert into public.chat_transcript_lines (
  chat_id, user_id, message_id, seq, role, record, schema_version,
  training_eligible, created_at
)
select
  s.chat_id,
  s.user_id,
  s.message_id,
  s.seq,
  s.role,
  s.record,
  'clauxen.transcript.anthropic.v1',
  f.training_eligible,
  s.created_at
from sequenced s
join chat_transcript_rebuild_flags f
  on f.chat_id = s.chat_id and f.user_id = s.user_id;

-- Populate the normalized tool table from the same durable agent_ui actions.
insert into public.tool_calls (
  user_id, workspace_id, chat_id, message_id, provider_call_id, tool_name,
  provider, input, output, status, error, latency_ms, created_at
)
select
  m.user_id,
  c.workspace_id,
  m.chat_id,
  m.id,
  action.value->>'id',
  coalesce(nullif(action.value->>'name', ''), 'tool'),
  'clauxen-agent',
  coalesce(action.value->'input', '{}'::jsonb),
  case
    when action.value ? 'result'
      then jsonb_build_object('content', action.value->>'result')
    else null
  end,
  case
    when coalesce((action.value->>'isError')::boolean, false) then 'failed'
    when action.value ? 'result' then 'complete'
    when m.status = 'cancelled' then 'cancelled'
    else 'failed'
  end,
  case
    when coalesce((action.value->>'isError')::boolean, false)
      then jsonb_build_object(
        'message', coalesce(action.value->>'result', 'Tool failed.')
      )
    else null
  end,
  case
    when nullif(action.value->>'startedAtMs', '') is not null
      and nullif(action.value->>'completedAtMs', '') is not null
      then greatest(
        0,
        (action.value->>'completedAtMs')::bigint -
          (action.value->>'startedAtMs')::bigint
      )::integer
    else null
  end,
  coalesce(
    to_timestamp(
      nullif(action.value->>'startedAtMs', '')::double precision / 1000
    ),
    m.created_at
  )
from public.chat_messages m
join public.chats c on c.id = m.chat_id and c.user_id = m.user_id
cross join jsonb_array_elements(
  case
    when jsonb_typeof(m.content_json->'agent_ui'->'actions') = 'array'
      then m.content_json->'agent_ui'->'actions'
    else '[]'::jsonb
  end
) as action(value)
where m.role = 'assistant'
  and nullif(action.value->>'id', '') is not null
on conflict (message_id, provider_call_id)
  where message_id is not null and provider_call_id is not null
do update set
  tool_name = excluded.tool_name,
  input = excluded.input,
  output = excluded.output,
  status = excluded.status,
  error = excluded.error,
  latency_ms = excluded.latency_ms;
