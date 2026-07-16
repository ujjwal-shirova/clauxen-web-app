-- Mirror dashboard hardening already applied by Supabase agent (idempotent).

-- Duplicate index cleanup
drop index if exists public.chats_user_updated_idx;

-- Initplan-friendly ownership policy on transcript lines
alter policy "own_chat_transcript_lines" on public.chat_transcript_lines
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Explicit deny policies for RLS tables that must stay service-role only
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='inference_gateway_requests' and policyname='deny_authenticated_all'
  ) then
    create policy "deny_authenticated_all"
      on public.inference_gateway_requests as restrictive for all to authenticated
      using (false) with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='model_usage_realtime_windows' and policyname='deny_authenticated_all'
  ) then
    create policy "deny_authenticated_all"
      on public.model_usage_realtime_windows as restrictive for all to authenticated
      using (false) with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='provider_capacity_windows' and policyname='deny_authenticated_all'
  ) then
    create policy "deny_authenticated_all"
      on public.provider_capacity_windows as restrictive for all to authenticated
      using (false) with check (false);
  end if;
end $$;

-- Tighten chat/research/tool policies to authenticated (not public)
do $$
begin
  begin alter policy "own_chat_branches" on public.chat_branches to authenticated; exception when others then null; end;
  begin alter policy "own_chat_message_parts" on public.chat_message_parts to authenticated; exception when others then null; end;
  begin alter policy "own_chat_message_reactions" on public.chat_message_reactions to authenticated; exception when others then null; end;
  begin alter policy "own_chat_messages" on public.chat_messages to authenticated; exception when others then null; end;
  begin alter policy "own_chat_transcript_lines" on public.chat_transcript_lines to authenticated; exception when others then null; end;
  begin alter policy "research_runs_insert_own" on public.research_runs to authenticated; exception when others then null; end;
  begin alter policy "research_runs_select_own" on public.research_runs to authenticated; exception when others then null; end;
  begin alter policy "research_runs_update_own" on public.research_runs to authenticated; exception when others then null; end;
  begin alter policy "own_tool_calls" on public.tool_calls to authenticated; exception when others then null; end;
end $$;
