-- Covering indexes for unindexed foreign keys on chat_generation_jobs
-- Prevents sequential table scans during chat_messages cascade/set-null checks

CREATE INDEX IF NOT EXISTS chat_generation_jobs_assistant_msg_idx
  ON public.chat_generation_jobs (assistant_message_id)
  WHERE assistant_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_generation_jobs_user_msg_idx
  ON public.chat_generation_jobs (user_message_id)
  WHERE user_message_id IS NOT NULL;
