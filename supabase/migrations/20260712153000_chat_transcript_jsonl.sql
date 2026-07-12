-- Training-friendly Cursor-style JSONL transcripts per chat.
-- Each line is one jsonb record (export = string_agg(record::text, E'\n' ORDER BY seq)).

create table if not exists public.chat_transcript_lines (
  id bigint generated always as identity primary key,
  chat_id text not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete set null,
  seq integer not null,
  role text not null check (role in ('user', 'assistant', 'system', 'tool', 'meta')),
  -- Full JSONL object, e.g. {"role":"user","message":{"content":[{"type":"text","text":"..."}]}}
  -- or meta {"type":"turn_ended","status":"success"}
  record jsonb not null,
  schema_version text not null default 'clauxen.transcript.v1',
  training_eligible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (chat_id, seq)
);

comment on table public.chat_transcript_lines is
  'Append-only Cursor-style JSONL transcript lines for training export (one jsonb object per line).';
comment on column public.chat_transcript_lines.record is
  'Single JSONL record: role+message.content parts, or meta turn_ended.';
comment on column public.chat_transcript_lines.training_eligible is
  'When false, exclude from company training exports (consent / redaction).';

create index if not exists chat_transcript_lines_chat_seq_idx
  on public.chat_transcript_lines (chat_id, seq);

create index if not exists chat_transcript_lines_user_created_idx
  on public.chat_transcript_lines (user_id, created_at desc);

create index if not exists chat_transcript_lines_training_idx
  on public.chat_transcript_lines (training_eligible, created_at desc)
  where training_eligible = true;

alter table public.chat_transcript_lines enable row level security;

drop policy if exists own_chat_transcript_lines on public.chat_transcript_lines;
create policy own_chat_transcript_lines
  on public.chat_transcript_lines
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Atomically append the next seq for a chat (locks chat row).
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

  perform 1 from public.chats where id = p_chat_id for update;

  select coalesce(max(seq), 0) + 1
    into next_seq
  from public.chat_transcript_lines
  where chat_id = p_chat_id;

  insert into public.chat_transcript_lines (
    chat_id, user_id, message_id, seq, role, record, schema_version, training_eligible
  ) values (
    p_chat_id, p_user_id, p_message_id, next_seq, p_role, p_record,
    coalesce(nullif(p_schema_version, ''), 'clauxen.transcript.v1'),
    coalesce(p_training_eligible, true)
  )
  returning * into inserted;

  return inserted;
end;
$$;

revoke all on function public.append_chat_transcript_line(text, uuid, uuid, text, jsonb, text, boolean)
  from public;
grant execute on function public.append_chat_transcript_line(text, uuid, uuid, text, jsonb, text, boolean)
  to service_role;

-- Rebuild all lines for a chat (used when branch tree becomes canonical).
create or replace function public.replace_chat_transcript_lines(
  p_chat_id text,
  p_user_id uuid,
  p_lines jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  line jsonb;
  idx integer := 0;
begin
  if not exists (
    select 1 from public.chats
    where id = p_chat_id and user_id = p_user_id and status != 'deleted'
  ) then
    raise exception 'chat not found or not owned by user';
  end if;

  perform 1 from public.chats where id = p_chat_id for update;
  delete from public.chat_transcript_lines where chat_id = p_chat_id;

  for line in
    select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    idx := idx + 1;
    insert into public.chat_transcript_lines (
      chat_id, user_id, message_id, seq, role, record, schema_version, training_eligible
    ) values (
      p_chat_id,
      p_user_id,
      nullif(line->>'message_id', '')::uuid,
      idx,
      coalesce(nullif(line->>'role', ''), 'meta'),
      coalesce(line->'record', line),
      coalesce(nullif(line->>'schema_version', ''), 'clauxen.transcript.v1'),
      coalesce((line->>'training_eligible')::boolean, true)
    );
  end loop;

  return idx;
end;
$$;

revoke all on function public.replace_chat_transcript_lines(text, uuid, jsonb) from public;
grant execute on function public.replace_chat_transcript_lines(text, uuid, jsonb) to service_role;

-- Easy company export: one JSONL document per chat.
create or replace view public.chat_transcripts_jsonl as
select
  t.chat_id,
  t.user_id,
  c.title as chat_title,
  count(*)::integer as line_count,
  bool_and(t.training_eligible) as training_eligible,
  min(t.created_at) as started_at,
  max(t.created_at) as updated_at,
  string_agg(t.record::text, E'\n' order by t.seq) as jsonl
from public.chat_transcript_lines t
join public.chats c on c.id = t.chat_id
where c.status != 'deleted'
group by t.chat_id, t.user_id, c.title;

comment on view public.chat_transcripts_jsonl is
  'Aggregated Cursor-style JSONL per chat for training export (COPY jsonl).';

-- Keep structured content_json filled for message-level training slices.
comment on column public.chat_messages.content_json is
  'Structured message payload; prefer Cursor-style {"role","message":{"content":[...]}} when present.';
