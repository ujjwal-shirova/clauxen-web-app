-- Align legacy RPCs with text chat ids (long-form Clauxen ids are not UUIDs).

create or replace function public.record_model_usage(
  p_user_id uuid,
  p_workspace_id uuid,
  p_chat_id text,
  p_message_id uuid,
  p_provider text,
  p_model_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.model_usage_events (
    user_id, workspace_id, chat_id, message_id, provider, model_id,
    input_tokens, output_tokens, latency_ms, metadata
  )
  values (
    p_user_id, p_workspace_id, p_chat_id, p_message_id, p_provider, p_model_id,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    p_latency_ms,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Drop old uuid overload if Postgres kept both.
drop function if exists public.record_model_usage(
  uuid, uuid, uuid, uuid, text, text, integer, integer, integer, jsonb
);

create or replace function public.append_chat_message(
  p_chat_id text,
  p_role text,
  p_content text,
  p_content_json jsonb default '{}'::jsonb,
  p_branch_id uuid default null,
  p_parent_message_id uuid default null,
  p_model_id text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  inserted public.chat_messages;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.chats
    where id = p_chat_id and user_id = v_uid and status != 'deleted'
  ) then
    raise exception 'chat not found';
  end if;

  insert into public.chat_messages (
    chat_id, user_id, role, content, content_json, status
  ) values (
    p_chat_id, v_uid, p_role, p_content, coalesce(p_content_json, '{}'::jsonb), 'complete'
  )
  returning * into inserted;

  return inserted;
end;
$$;

drop function if exists public.append_chat_message(
  uuid, text, text, jsonb, uuid, uuid, text, integer, integer
);
