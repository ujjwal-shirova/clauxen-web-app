-- Source: 20260506160000_core_backend.sql
-- Statement index: 42

create policy "Users can upload own storage objects" on storage.objects
for insert to authenticated
with check (bucket_id in ('user-uploads', 'avatars', 'artifacts') and (storage.foldername(name))[1] = auth.uid()::text)
