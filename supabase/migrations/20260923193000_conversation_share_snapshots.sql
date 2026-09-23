-- Frozen copy of a chat at the moment a share link is created.
-- Anon has no policy on this table. Public reads go through the share worker
-- after a human check, not through the Data API.

alter table public.conversation_shares
  add column if not exists snapshot jsonb;

comment on column public.conversation_shares.snapshot is
  'User and assistant messages captured when the share link was created. Later chat messages are not added.';
