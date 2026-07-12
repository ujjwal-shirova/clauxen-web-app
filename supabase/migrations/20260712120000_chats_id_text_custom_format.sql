-- Allow Clauxen long-form chat IDs (text). Existing UUID rows remain valid as text.

drop policy if exists own_chat_branches on public.chat_branches;
drop policy if exists own_chat_messages on public.chat_messages;
drop policy if exists own_tool_calls on public.tool_calls;
drop policy if exists own_chat_message_parts on public.chat_message_parts;
drop policy if exists own_chat_message_reactions on public.chat_message_reactions;

alter table public.artifacts drop constraint if exists artifacts_chat_id_fkey;
alter table public.chat_branches drop constraint if exists chat_branches_chat_id_fkey;
alter table public.chat_messages drop constraint if exists chat_messages_chat_id_fkey;
alter table public.conversation_shares drop constraint if exists conversation_shares_chat_id_fkey;
alter table public.model_usage_events drop constraint if exists model_usage_events_chat_id_fkey;
alter table public.moderation_events drop constraint if exists moderation_events_chat_id_fkey;
alter table public.pinned_chats drop constraint if exists pinned_chats_chat_id_fkey;
alter table public.research_runs drop constraint if exists research_runs_chat_id_fkey;
alter table public.tool_calls drop constraint if exists tool_calls_chat_id_fkey;

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='chat_branch_states'
      and constraint_type='FOREIGN KEY' and constraint_name like '%chat_id%'
  ) then
    execute (
      select 'alter table public.chat_branch_states drop constraint ' || quote_ident(constraint_name)
      from information_schema.table_constraints
      where table_schema='public' and table_name='chat_branch_states'
        and constraint_type='FOREIGN KEY' and constraint_name like '%chat_id%'
      limit 1
    );
  end if;
end $$;

alter table public.chats alter column id drop default;
alter table public.chats alter column id type text using id::text;
alter table public.artifacts alter column chat_id type text using chat_id::text;
alter table public.chat_branches alter column chat_id type text using chat_id::text;
alter table public.chat_messages alter column chat_id type text using chat_id::text;
alter table public.conversation_shares alter column chat_id type text using chat_id::text;
alter table public.model_usage_events alter column chat_id type text using chat_id::text;
alter table public.moderation_events alter column chat_id type text using chat_id::text;
alter table public.pinned_chats alter column chat_id type text using chat_id::text;
alter table public.research_runs alter column chat_id type text using chat_id::text;
alter table public.tool_calls alter column chat_id type text using chat_id::text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='chat_branch_states' and column_name='chat_id'
  ) then
    execute 'alter table public.chat_branch_states alter column chat_id type text using chat_id::text';
  end if;
end $$;

alter table public.artifacts
  add constraint artifacts_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete set null;
alter table public.chat_branches
  add constraint chat_branches_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete cascade;
alter table public.chat_messages
  add constraint chat_messages_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete cascade;
alter table public.conversation_shares
  add constraint conversation_shares_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete cascade;
alter table public.model_usage_events
  add constraint model_usage_events_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete set null;
alter table public.moderation_events
  add constraint moderation_events_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete set null;
alter table public.pinned_chats
  add constraint pinned_chats_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete cascade;
alter table public.research_runs
  add constraint research_runs_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete set null;
alter table public.tool_calls
  add constraint tool_calls_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete set null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='chat_branch_states' and column_name='chat_id'
  ) then
    begin
      execute 'alter table public.chat_branch_states add constraint chat_branch_states_chat_id_fkey foreign key (chat_id) references public.chats(id) on delete cascade';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

create policy own_chat_branches on public.chat_branches for all
  using (exists (select 1 from public.chats c where c.id = chat_branches.chat_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.chats c where c.id = chat_branches.chat_id and c.user_id = (select auth.uid())));

create policy own_chat_messages on public.chat_messages for all
  using (((select auth.uid()) = user_id) or exists (select 1 from public.chats c where c.id = chat_messages.chat_id and c.user_id = (select auth.uid())))
  with check (((select auth.uid()) = user_id) or exists (select 1 from public.chats c where c.id = chat_messages.chat_id and c.user_id = (select auth.uid())));

create policy own_tool_calls on public.tool_calls for all
  using (((select auth.uid()) = user_id) or exists (select 1 from public.chat_messages m join public.chats c on c.id = m.chat_id where m.id = tool_calls.message_id and c.user_id = (select auth.uid())))
  with check (((select auth.uid()) = user_id) or exists (select 1 from public.chat_messages m join public.chats c on c.id = m.chat_id where m.id = tool_calls.message_id and c.user_id = (select auth.uid())));

create policy own_chat_message_parts on public.chat_message_parts for all
  using (exists (select 1 from public.chat_messages m join public.chats c on c.id = m.chat_id where m.id = chat_message_parts.message_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.chat_messages m join public.chats c on c.id = m.chat_id where m.id = chat_message_parts.message_id and c.user_id = (select auth.uid())));

create policy own_chat_message_reactions on public.chat_message_reactions for all
  using (((select auth.uid()) = user_id) or exists (select 1 from public.chat_messages m join public.chats c on c.id = m.chat_id where m.id = chat_message_reactions.message_id and c.user_id = (select auth.uid())))
  with check ((select auth.uid()) = user_id);

create or replace function public.chat_id_exists(p_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.chats where id = p_id);
$$;

revoke all on function public.chat_id_exists(text) from public;
grant execute on function public.chat_id_exists(text) to service_role, authenticated;
