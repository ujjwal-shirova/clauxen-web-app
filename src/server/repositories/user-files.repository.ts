import { query, queryOne } from "@/server/db/pool";

export type UserFileRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  folder_id: string | null;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  content_hash: string | null;
  status: string;
  metadata: Record<string, unknown>;
  storage_url: string | null;
  created_at: string;
  updated_at: string;
};

export type LibraryFolderRow = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
};

const USER_FILE_COLUMNS = `id, user_id, workspace_id, folder_id,
  original_name, mime_type, size_bytes, storage_bucket, storage_path,
  content_hash, status, metadata, storage_url, created_at, updated_at`;

export type UserFileStorageStats = {
  total_bytes: number;
  file_count: number;
  image_bytes: number;
  image_count: number;
  document_bytes: number;
  document_count: number;
};

export async function getUserFile(fileId: string, userId: string) {
  return queryOne<UserFileRow>(
    `select ${USER_FILE_COLUMNS}
     from public.user_files
     where id = $1 and user_id = $2 and status != 'deleted'`,
    [fileId, userId],
  );
}

/** Current (or latest) uploaded avatar for a user. Safe for public profile-photo reads. */
export async function getPublicAvatarFile(userId: string) {
  const linked = await queryOne<UserFileRow>(
    `select ${USER_FILE_COLUMNS}
     from public.user_files uf
     join public.profiles p
       on p.avatar_file_id = uf.id
      and p.id = uf.user_id
     where p.id = $1
       and uf.status = 'uploaded'`,
    [userId],
  );
  if (linked) return linked;

  return queryOne<UserFileRow>(
    `select ${USER_FILE_COLUMNS}
     from public.user_files
     where user_id = $1
       and status = 'uploaded'
       and coalesce(metadata->>'purpose', '') = 'avatar'
     order by updated_at desc
     limit 1`,
    [userId],
  );
}

export async function listUserFiles(
  userId: string,
  folderId: string | null = null,
  limit = 500,
) {
  return query<UserFileRow>(
    `select ${USER_FILE_COLUMNS}
     from public.user_files
     where user_id = $1
       and folder_id is not distinct from $2::uuid
       and status not in ('deleted', 'failed')
     order by updated_at desc
     limit $3`,
    [userId, folderId, limit],
  );
}

export async function listLibraryFolders(
  userId: string,
  parentId: string | null = null,
) {
  return query<LibraryFolderRow>(
    `select id, user_id, parent_id, name, created_at, updated_at
     from public.library_folders
     where user_id = $1 and parent_id is not distinct from $2::uuid
     order by lower(name), created_at`,
    [userId, parentId],
  );
}

export async function listAllLibraryFolders(userId: string) {
  return query<LibraryFolderRow>(
    `select id, user_id, parent_id, name, created_at, updated_at
     from public.library_folders
     where user_id = $1
     order by lower(name), created_at`,
    [userId],
  );
}

export async function getLibraryFolder(folderId: string, userId: string) {
  return queryOne<LibraryFolderRow>(
    `select id, user_id, parent_id, name, created_at, updated_at
     from public.library_folders
     where id = $1 and user_id = $2`,
    [folderId, userId],
  );
}

export async function createLibraryFolder(input: {
  userId: string;
  parentId?: string | null;
  name: string;
}) {
  return queryOne<LibraryFolderRow>(
    `insert into public.library_folders (user_id, parent_id, name)
     values ($1, $2, $3)
     returning id, user_id, parent_id, name, created_at, updated_at`,
    [input.userId, input.parentId ?? null, input.name],
  );
}

export async function getFolderBreadcrumbs(folderId: string, userId: string) {
  return query<LibraryFolderRow>(
    `with recursive ancestors as (
       select id, user_id, parent_id, name, created_at, updated_at, 0 as depth
       from public.library_folders where id = $1 and user_id = $2
       union all
       select f.id, f.user_id, f.parent_id, f.name, f.created_at, f.updated_at,
              a.depth + 1
       from public.library_folders f
       join ancestors a on a.parent_id = f.id and a.user_id = f.user_id
     )
     select id, user_id, parent_id, name, created_at, updated_at
     from ancestors order by depth desc`,
    [folderId, userId],
  );
}

export async function createUserFile(input: {
  userId: string;
  workspaceId?: string | null;
  folderId?: string | null;
  originalName: string;
  mimeType?: string | null;
  sizeBytes?: number;
  storageBucket: string;
  storagePath: string;
  contentHash?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
  storageUrl?: string | null;
  projectId?: string | null;
}) {
  return queryOne<UserFileRow>(
    `insert into public.user_files (
       user_id, workspace_id, folder_id, original_name, mime_type,
       size_bytes, storage_bucket, storage_path, content_hash, status, metadata,
       storage_url, project_id
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
     returning ${USER_FILE_COLUMNS}`,
    [
      input.userId,
      input.workspaceId ?? null,
      input.folderId ?? null,
      input.originalName,
      input.mimeType ?? null,
      input.sizeBytes ?? 0,
      input.storageBucket,
      input.storagePath,
      input.contentHash ?? null,
      input.status ?? "pending",
      JSON.stringify(input.metadata ?? {}),
      input.storageUrl ?? null,
      input.projectId ?? null,
    ],
  );
}

export async function updateUserFile(
  fileId: string,
  userId: string,
  patch: {
    status?: string;
    sizeBytes?: number;
    contentHash?: string | null;
    metadata?: Record<string, unknown>;
    storageUrl?: string | null;
  },
) {
  return queryOne<UserFileRow>(
    `update public.user_files set
       status = coalesce($3, status),
       size_bytes = coalesce($4, size_bytes),
       content_hash = coalesce($5, content_hash),
       metadata = coalesce($6::jsonb, metadata),
       storage_url = coalesce($7, storage_url),
       updated_at = now()
     where id = $1 and user_id = $2 and status != 'deleted'
     returning ${USER_FILE_COLUMNS}`,
    [
      fileId,
      userId,
      patch.status ?? null,
      patch.sizeBytes ?? null,
      patch.contentHash ?? null,
      patch.metadata ? JSON.stringify(patch.metadata) : null,
      patch.storageUrl ?? null,
    ],
  );
}

export async function updateLibraryFileLocation(input: {
  fileId: string;
  userId: string;
  folderId?: string | null;
  originalName?: string;
  storagePath?: string;
}) {
  return queryOne<UserFileRow>(
    `update public.user_files set
       folder_id = coalesce($3::uuid, folder_id),
       original_name = coalesce($4, original_name),
       storage_path = coalesce($5, storage_path),
       updated_at = now()
     where id = $1 and user_id = $2 and status != 'deleted'
     returning ${USER_FILE_COLUMNS}`,
    [
      input.fileId,
      input.userId,
      input.folderId === undefined ? null : input.folderId,
      input.originalName ?? null,
      input.storagePath ?? null,
    ],
  );
}

export async function moveLibraryFileToRoot(input: {
  fileId: string;
  userId: string;
  originalName?: string;
  storagePath?: string;
}) {
  return queryOne<UserFileRow>(
    `update public.user_files set
       folder_id = null,
       original_name = coalesce($3, original_name),
       storage_path = coalesce($4, storage_path),
       updated_at = now()
     where id = $1 and user_id = $2 and status != 'deleted'
     returning ${USER_FILE_COLUMNS}`,
    [
      input.fileId,
      input.userId,
      input.originalName ?? null,
      input.storagePath ?? null,
    ],
  );
}

export async function renameLibraryFolder(
  folderId: string,
  userId: string,
  name: string,
) {
  return queryOne<LibraryFolderRow>(
    `update public.library_folders set name = $3, updated_at = now()
     where id = $1 and user_id = $2
     returning id, user_id, parent_id, name, created_at, updated_at`,
    [folderId, userId, name],
  );
}

export async function moveLibraryFolder(
  folderId: string,
  userId: string,
  parentId: string | null,
) {
  return queryOne<LibraryFolderRow>(
    `update public.library_folders set parent_id = $3, updated_at = now()
     where id = $1 and user_id = $2
       and not exists (
         with recursive descendants as (
           select id from public.library_folders where id = $1 and user_id = $2
           union all
           select f.id from public.library_folders f
           join descendants d on f.parent_id = d.id
           where f.user_id = $2
         )
         select 1 from descendants where id = $3
       )
     returning id, user_id, parent_id, name, created_at, updated_at`,
    [folderId, userId, parentId],
  );
}

export async function deleteLibraryFolder(folderId: string, userId: string) {
  return queryOne<{ id: string }>(
    `delete from public.library_folders
     where id = $1 and user_id = $2
       and not exists (
         select 1 from public.library_folders where parent_id = $1 and user_id = $2
       )
       and not exists (
         select 1 from public.user_files
         where folder_id = $1 and user_id = $2 and status != 'deleted'
       )
     returning id`,
    [folderId, userId],
  );
}

export async function deleteUserFile(fileId: string, userId: string) {
  return queryOne<{ id: string; storage_bucket: string; storage_path: string }>(
    `update public.user_files
     set status = 'deleted', updated_at = now()
     where id = $1 and user_id = $2 and status != 'deleted'
     returning id, storage_bucket, storage_path`,
    [fileId, userId],
  );
}

export async function getUserFileStorageStats(userId: string) {
  return queryOne<UserFileStorageStats>(
    `select
       coalesce(sum(size_bytes), 0)::bigint as total_bytes,
       count(*)::int as file_count,
       coalesce(sum(size_bytes) filter (where mime_type like 'image/%'), 0)::bigint as image_bytes,
       count(*) filter (where mime_type like 'image/%')::int as image_count,
       coalesce(sum(size_bytes) filter (where mime_type is null or mime_type not like 'image/%'), 0)::bigint as document_bytes,
       count(*) filter (where mime_type is null or mime_type not like 'image/%')::int as document_count
     from public.user_files
     where user_id = $1 and status not in ('deleted', 'failed')`,
    [userId],
  );
}
