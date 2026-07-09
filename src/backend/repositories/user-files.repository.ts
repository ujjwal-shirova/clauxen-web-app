import { query, queryOne } from "@/backend/db/pool";

export type UserFileRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  project_id: string | null;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  content_hash: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

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
    `select id, user_id, workspace_id, project_id, original_name, mime_type,
            size_bytes, storage_bucket, storage_path, content_hash, status,
            metadata, created_at, updated_at
     from public.user_files
     where id = $1 and user_id = $2 and status != 'deleted'`,
    [fileId, userId],
  );
}

export async function listUserFiles(userId: string, limit = 100) {
  return query<UserFileRow>(
    `select id, user_id, workspace_id, project_id, original_name, mime_type,
            size_bytes, storage_bucket, storage_path, content_hash, status,
            metadata, created_at, updated_at
     from public.user_files
     where user_id = $1 and status != 'deleted'
     order by created_at desc
     limit $2`,
    [userId, limit],
  );
}

export async function createUserFile(input: {
  userId: string;
  workspaceId?: string | null;
  projectId?: string | null;
  originalName: string;
  mimeType?: string | null;
  sizeBytes?: number;
  storageBucket: string;
  storagePath: string;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  return queryOne<UserFileRow>(
    `insert into public.user_files (
       user_id, workspace_id, project_id, original_name, mime_type, size_bytes,
       storage_bucket, storage_path, status, metadata
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     returning id, user_id, workspace_id, project_id, original_name, mime_type,
               size_bytes, storage_bucket, storage_path, content_hash, status,
               metadata, created_at, updated_at`,
    [
      input.userId,
      input.workspaceId ?? null,
      input.projectId ?? null,
      input.originalName,
      input.mimeType ?? null,
      input.sizeBytes ?? 0,
      input.storageBucket,
      input.storagePath,
      input.status ?? "pending",
      JSON.stringify(input.metadata ?? {}),
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
  },
) {
  return queryOne<UserFileRow>(
    `update public.user_files set
       status = coalesce($3, status),
       size_bytes = coalesce($4, size_bytes),
       content_hash = coalesce($5, content_hash),
       metadata = coalesce($6::jsonb, metadata),
       updated_at = now()
     where id = $1 and user_id = $2 and status != 'deleted'
     returning id, user_id, workspace_id, project_id, original_name, mime_type,
               size_bytes, storage_bucket, storage_path, content_hash, status,
               metadata, created_at, updated_at`,
    [
      fileId,
      userId,
      patch.status ?? null,
      patch.sizeBytes ?? null,
      patch.contentHash ?? null,
      patch.metadata ? JSON.stringify(patch.metadata) : null,
    ],
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
