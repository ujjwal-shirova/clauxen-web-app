-- Security hardening flagged by Supabase Advisors:
-- 1. Fix mutable search_path on generate_gift_code_20
ALTER FUNCTION public.generate_gift_code_20() SET search_path = public;

-- 2. Revoke execute on sensitive SECURITY DEFINER functions from anonymous role
REVOKE EXECUTE ON FUNCTION public.fetch_chat_thread_page(text, uuid, uuid, bigint, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.switch_chat_branch(text, uuid, uuid) FROM anon;
