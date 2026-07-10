-- Live profile updates (display name / avatar) for sidebar + welcome greeting.
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

alter table public.profiles replica identity full;
