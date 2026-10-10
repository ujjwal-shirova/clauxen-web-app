-- Run inside a transaction and ROLLBACK. Fixtures never invoke providers.
do $$
declare
  v_chat text; v_user uuid; j1 uuid := gen_random_uuid(); j2 uuid := gen_random_uuid();
  k text := gen_random_uuid()::text; claimed public.chat_generation_jobs; n integer;
begin
  select id,user_id into v_chat,v_user from public.chats c where status != 'deleted'
    and not exists(select 1 from public.chat_generation_jobs j where j.chat_id=c.id and j.status in ('queued','running','continuing'))
    order by created_at limit 1;
  if v_chat is null then raise exception 'Need an idle fixture chat'; end if;
  insert into public.chat_generation_jobs(id,chat_id,user_id,input,created_at)
    values(j1,v_chat,v_user,jsonb_build_object('turn',jsonb_build_object('assistantClientId',k)),now()-interval '2 seconds');
  insert into public.chat_generation_jobs(id,chat_id,user_id,input,created_at)
    values(j2,v_chat,v_user,jsonb_build_object('turn',jsonb_build_object('assistantClientId',k||'-next')),now());
  claimed := public.claim_chat_generation_job(j2,'later-worker');
  if claimed.id is not null then raise exception 'Queue executed out of order'; end if;
  claimed := public.claim_chat_generation_job(j1,'first-worker');
  if claimed.id != j1 or claimed.status != 'running' then raise exception 'First queued job not claimed'; end if;
  claimed := public.claim_chat_generation_job(j1,'duplicate-worker');
  if claimed.id is not null then raise exception 'Duplicate worker stole a healthy job'; end if;
  claimed := public.claim_chat_generation_job(j2,'later-worker');
  if claimed.id is not null then raise exception 'Two jobs executed in one chat'; end if;
  insert into public.chat_generation_jobs(chat_id,user_id,input)
    values(v_chat,v_user,jsonb_build_object('turn',jsonb_build_object('assistantClientId',k))) on conflict do nothing;
  get diagnostics n = row_count;
  if n != 0 then raise exception 'Submission retry admitted a duplicate'; end if;
  update public.chat_generation_jobs set heartbeat_at=now()-interval '91 seconds' where id=j1;
  claimed := public.claim_chat_generation_job(j1,'replacement-worker');
  if claimed.locked_by != 'replacement-worker' or claimed.attempt != 1 then raise exception 'Crash takeover failed'; end if;
  update public.chat_generation_jobs set checkpoint='{"answer":"stale overwrite"}'
    where id=j1 and locked_by='first-worker' and status='running';
  get diagnostics n = row_count;
  if n != 0 then raise exception 'Old worker wrote after takeover'; end if;
  update public.chat_generation_jobs set status='cancelled',locked_by=null where id=j1;
  claimed := public.claim_chat_generation_job(j1,'revive-cancelled');
  if claimed.id is not null then raise exception 'Cancelled task restarted'; end if;
  claimed := public.claim_chat_generation_job(j2,'next-worker');
  if claimed.id != j2 then raise exception 'Queued task did not unblock after cancellation'; end if;
  if has_table_privilege('authenticated','public.chat_generation_jobs','select') or
     has_function_privilege('authenticated','public.claim_chat_generation_job(uuid,text,interval)','execute') then
    raise exception 'Background execution exposed to browser role';
  end if;
end;
$$;
select 'queue_order, duplicate_submission, single_owner, stale_recovery, fencing, cancellation, access_control: PASS' as checks;
