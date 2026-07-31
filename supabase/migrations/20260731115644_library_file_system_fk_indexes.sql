create index if not exists library_folders_parent_user_fk_idx
  on public.library_folders (parent_id, user_id);

create index if not exists user_files_folder_user_fk_idx
  on public.user_files (folder_id, user_id)
  where folder_id is not null;
