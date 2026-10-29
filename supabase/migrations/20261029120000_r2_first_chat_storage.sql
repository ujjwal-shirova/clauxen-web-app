-- R2-first conversation storage.
--
-- Supabase keeps identity, ownership, tree position, status, previews and
-- search lexemes. Full message bodies (text + structured trace JSON), job
-- payloads and share snapshots live in the private Cloudflare R2
-- chat-archives bucket. `content` / `content_json` remain only as a hot
-- fallback while a turn is streaming or when R2 is unavailable.

begin;

-- ---------------------------------------------------------------------------
-- Legacy body duplication
-- ---------------------------------------------------------------------------

-- Transcript JSONL duplicated every message body inside Postgres. Export and
-- training paths now rebuild from R2 payloads.
drop view if exists public.chat_transcripts_jsonl;
drop table if exists public.chat_transcript_lines cascade;
drop function if exists public.append_chat_transcript_line(
  text, uuid, uuid, text, jsonb, text, boolean
);
drop function if exists public.replace_chat_transcript_lines(text, uuid, jsonb);

-- Unused APIs that assumed message text lived in the row.
drop function if exists public.search_user_messages(text, integer);
drop function if exists public.append_chat_message(
  text, text, text, jsonb, uuid, uuid, text, integer, integer
);
drop function if exists public.fetch_chat_messages_page(
  text, uuid, timestamp with time zone, uuid, integer
);

-- Branch rows were superseded by parent_message_id + active_leaf_message_id.
alter table public.chat_messages drop column if exists branch_id;
drop table if exists public.chat_branches cascade;
drop table if exists public.chat_message_reactions cascade;

-- ---------------------------------------------------------------------------
-- Message metadata: preview + search lexemes (no full text stored)
-- ---------------------------------------------------------------------------

alter table public.chat_messages
  add column if not exists preview text,
  add column if not exists search_vector tsvector;

drop index if exists public.chat_messages_content_unaccent_gin_idx;
alter table public.chat_messages
  drop column if exists content_search,
  drop column if exists content_search_unaccent;

create index if not exists chat_messages_search_vector_idx
  on public.chat_messages using gin (search_vector);

comment on column public.chat_messages.content is
  'Hot streaming buffer only. Cleared after the R2 payload is written; never the system of record.';
comment on column public.chat_messages.content_json is
  'Hot streaming buffer only. Cleared after the R2 payload is written; never the system of record.';
comment on column public.chat_messages.preview is
  'Bounded plain-text preview for listings and search snippets (first 400 chars).';
comment on column public.chat_messages.search_vector is
  'Full-text lexemes derived from the body at finalize; no message text is recoverable from it.';

-- ---------------------------------------------------------------------------
-- R2 payload pointers
-- ---------------------------------------------------------------------------

create table if not exists public.chat_message_payloads (
  message_id uuid primary key
    references public.chat_messages(id) on delete cascade,
  chat_id text not null
    references public.chats(id) on delete cascade,
  user_id uuid
    references auth.users(id) on delete set null,
  r2_key text not null unique,
  sha256 text not null,
  byte_size bigint not null check (byte_size >= 0),
  format_version smallint not null default 1,
  created_at timestamp with time zone not null default now()
);

create index if not exists chat_message_payloads_chat_idx
  on public.chat_message_payloads (chat_id);
create index if not exists chat_message_payloads_user_idx
  on public.chat_message_payloads (user_id)
  where user_id is not null;

alter table public.chat_message_payloads enable row level security;

drop policy if exists chat_message_payloads_owner_read
  on public.chat_message_payloads;
create policy chat_message_payloads_owner_read
  on public.chat_message_payloads
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.chats c
      where c.id = chat_message_payloads.chat_id
        and c.user_id = (select auth.uid())
    )
  );

comment on table public.chat_message_payloads is
  'Pointer to the canonical message body object in the private R2 chat-archives bucket.';

-- ---------------------------------------------------------------------------
-- Share snapshots move to R2
-- ---------------------------------------------------------------------------

alter table public.conversation_shares
  add column if not exists snapshot_object_key text;
alter table public.conversation_shares
  alter column snapshot drop not null;

comment on column public.conversation_shares.snapshot is
  'Deprecated inline snapshot. New shares store snapshot_object_key instead.';

-- ---------------------------------------------------------------------------
-- Generation job payloads move to R2
-- ---------------------------------------------------------------------------

alter table public.chat_generation_jobs
  add column if not exists input_object_key text,
  add column if not exists checkpoint_object_key text;

comment on column public.chat_generation_jobs.input is
  'Small admission metadata (turn ids, fork, model). Prompt history lives in the R2 input object.';
comment on column public.chat_generation_jobs.checkpoint is
  'Small checkpoint marker. Conversation/answer state lives in the R2 checkpoint object.';

commit;
