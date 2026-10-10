-- Accepted prompts may queue while another prompt runs; one slice owns a chat.
drop index if exists public.chat_generation_jobs_one_active_per_chat;
create unique index chat_generation_jobs_one_executing_per_chat
  on public.chat_generation_jobs(chat_id) where status in ('running', 'continuing');
create unique index chat_generation_jobs_submission_key
  on public.chat_generation_jobs(chat_id, user_id, (input->'turn'->>'assistantClientId'))
  where input->'turn'->>'assistantClientId' is not null;
create index chat_generation_jobs_queue_order
  on public.chat_generation_jobs(chat_id, created_at, id) where status = 'queued';

create or replace function public.claim_chat_generation_job(
  p_job_id uuid, p_worker text,
  p_running_stale_after interval default interval '90 seconds'
) returns public.chat_generation_jobs
language plpgsql security definer set search_path = '' as $$
declare v_job public.chat_generation_jobs; v_chat text;
begin
  if p_worker is null or length(btrim(p_worker)) = 0 then return null; end if;
  select chat_id into v_chat from public.chat_generation_jobs where id = p_job_id;
  if v_chat is null then return null; end if;
  -- Transaction locks work through Supabase's transaction pooler. Serializes
  -- queued claimants on separate rows without waiting on a running model.
  if not pg_try_advisory_xact_lock(hashtextextended('chat-generation:' || v_chat, 0)) then
    return null;
  end if;
  select * into v_job from public.chat_generation_jobs
    where id = p_job_id for update skip locked;
  if not found then return null; end if;
  if v_job.status = 'queued' then
    if exists(select 1 from public.chat_generation_jobs
      where chat_id = v_chat and status in ('running', 'continuing'))
      or exists(select 1 from public.chat_generation_jobs
        where chat_id = v_chat and status = 'queued'
          and (created_at, id) < (v_job.created_at, v_job.id)) then
      return null;
    end if;
  elsif v_job.status = 'continuing' then null;
  elsif v_job.status = 'running' and v_job.heartbeat_at < now() -
      greatest(coalesce(p_running_stale_after, interval '90 seconds'), interval '90 seconds') then null;
  else return null;
  end if;
  update public.chat_generation_jobs set status = 'running', locked_by = p_worker,
    locked_at = now(), heartbeat_at = now(), updated_at = now(),
    attempt = case when v_job.status = 'running' then v_job.attempt + 1 else 0 end
    where id = p_job_id returning * into v_job;
  return v_job;
end;
$$;
revoke all on function public.claim_chat_generation_job(uuid,text,interval) from public, anon, authenticated;
grant execute on function public.claim_chat_generation_job(uuid,text,interval) to service_role;

create or replace function public.list_stalled_chat_generation_jobs(
 p_running_stale_after interval default interval '90 seconds', p_limit integer default 10
) returns setof public.chat_generation_jobs
language sql security definer set search_path = '' as $$
 select j.* from public.chat_generation_jobs j
 where (j.status = 'running' and j.heartbeat_at < now() - greatest(
   coalesce(p_running_stale_after, interval '90 seconds'), interval '90 seconds'))
 or (j.status = 'continuing')
 or (j.status = 'queued'
   and not exists(select 1 from public.chat_generation_jobs x
     where x.chat_id = j.chat_id and x.status in ('running','continuing'))
   and not exists(select 1 from public.chat_generation_jobs x
     where x.chat_id = j.chat_id and x.status = 'queued'
       and (x.created_at,x.id) < (j.created_at,j.id)))
 order by j.heartbeat_at, j.id limit greatest(1,least(coalesce(p_limit,10),25));
$$;
revoke all on function public.list_stalled_chat_generation_jobs(interval,integer) from public,anon,authenticated;
grant execute on function public.list_stalled_chat_generation_jobs(interval,integer) to service_role;
