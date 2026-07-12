-- Realtime for chats, profiles, settings, and file metadata (live sidebar / settings / library)
do $$ begin
  alter publication supabase_realtime add table public.chats;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.user_settings;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.user_files;
exception when duplicate_object then null;
end $$;

alter table public.profiles replica identity full;
alter table public.user_settings replica identity full;
alter table public.chats replica identity full;
alter table public.user_files replica identity full;
