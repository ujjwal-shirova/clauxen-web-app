-- Project chat reliability:
-- - keep user_files as the single R2 metadata table (no duplicate project_files)
-- - make project-scoped vector retrieval cheap
-- - retain partial assistant text after an explicit stop
-- - never manufacture a visible "Generation interrupted" assistant message

-- Older environments briefly had a second project_files metadata table.
-- Preserve every object reference in user_files before removing that overlap.
do $$
begin
  if to_regclass('public.project_files') is not null then
    execute $migration$
      insert into public.user_files (
        id, user_id, project_id, original_name, mime_type, size_bytes,
        storage_bucket, storage_path, content_hash, status, metadata,
        created_at, updated_at
      )
      select
        pf.id, pf.user_id, pf.project_id, pf.filename, pf.file_type,
        pf.file_size, pf.storage_bucket, pf.storage_path, pf.content_hash,
        case when pf.status = 'pending' then 'processing' else pf.status end,
        coalesce(pf.metadata, '{}'::jsonb)
          || jsonb_build_object('projectKnowledge', true)
          || case when pf.error_message is null then '{}'::jsonb
                  else jsonb_build_object('ingestion_error', pf.error_message) end,
        pf.created_at, pf.updated_at
      from public.project_files pf
      on conflict (storage_bucket, storage_path) do update
      set project_id = excluded.project_id,
          metadata = public.user_files.metadata || excluded.metadata,
          updated_at = greatest(public.user_files.updated_at, excluded.updated_at)
    $migration$;
    execute 'drop table public.project_files';
  end if;
end
$$;

create index if not exists document_chunks_project_file_project_idx
  on public.document_chunks ((metadata->>'project_id'), source_id, chunk_index)
  where source_type = 'project_file';

create unique index if not exists embeddings_chunk_id_unique_idx
  on public.embeddings (chunk_id);

create or replace function public.fetch_chat_messages_page(
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
    select 1 from public.chats c
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
      and (m.status != 'cancelled' or coalesce(trim(m.content), '') != '')
      and not (
        m.role = 'assistant'
        and coalesce(m.content, '') = 'Generation interrupted.'
      )
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
        and (older.status != 'cancelled' or coalesce(trim(older.content), '') != '')
        and not (
          older.role = 'assistant'
          and coalesce(older.content, '') = 'Generation interrupted.'
        )
        and (older.created_at, older.id) < (b.oldest_created_at, b.oldest_id)
    ) as has_more
  from page p
  order by p.created_at asc, p.id asc;
end;
$$;

revoke all on function public.fetch_chat_messages_page(
  text, uuid, timestamptz, uuid, int
) from public, anon, authenticated;
grant execute on function public.fetch_chat_messages_page(
  text, uuid, timestamptz, uuid, int
) to service_role;

create or replace function public.gc_stale_streaming_messages(
  p_older_than interval default interval '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with candidates as (
    select id
    from public.chat_messages
    where role = 'assistant'
      and status = 'streaming'
      and created_at < now() - p_older_than
    order by created_at asc
    limit 500
  ),
  updated as (
    update public.chat_messages m
    set
      status = case
        when coalesce(trim(m.content), '') = '' then 'failed'
        else 'complete'
      end,
      updated_at = now()
    from candidates c
    where m.id = c.id
    returning m.id
  )
  select count(*)::integer into v_count from updated;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.gc_stale_streaming_messages(interval)
  from public, anon, authenticated;
grant execute on function public.gc_stale_streaming_messages(interval)
  to service_role;
