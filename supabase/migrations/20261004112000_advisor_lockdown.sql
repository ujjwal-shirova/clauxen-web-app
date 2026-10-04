-- Security hardening: lock down internal tables and functions from direct PostgREST calls

-- 1. Revoke execute on internal chat RPCs from authenticated role (only backend server pool can execute)
REVOKE EXECUTE ON FUNCTION public.fetch_chat_thread_page(text, uuid, uuid, bigint, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.switch_chat_branch(text, uuid, uuid) FROM authenticated;

-- 2. Explicit RLS policies on internal tables to prevent PostgREST access while satisfying linter
CREATE POLICY "Deny direct client access to chat_generation_jobs"
  ON public.chat_generation_jobs
  FOR ALL
  TO authenticated, anon
  USING (false);

CREATE POLICY "Deny direct client access to cookie_consents"
  ON public.cookie_consents
  FOR ALL
  TO authenticated, anon
  USING (false);

CREATE POLICY "Deny direct client access to cookie_events"
  ON public.cookie_events
  FOR ALL
  TO authenticated, anon
  USING (false);
