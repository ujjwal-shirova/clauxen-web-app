-- Store the Cloudflare R2 gateway locator next to each user_files row.
-- Object bytes stay in R2; Postgres only holds the unique key + fetch URL.

alter table public.user_files
  add column if not exists storage_url text;

comment on column public.user_files.storage_url is
  'Cloudflare R2 gateway URL for this object. File bytes live in R2; Postgres stores the locator only.';

comment on column public.user_files.storage_path is
  'Object key inside the R2 bucket, scoped as users/{user_id}/… so keys never collide across users.';
