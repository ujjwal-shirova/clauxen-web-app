import { query, queryOne } from "@/server/db/pool";

export type ProjectFileRow = {
  id: string;
  project_id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_bucket: string;
  storage_path: string;
  content_hash: string | null;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function listProjectFiles(projectId: string, userId: string) {
  return query<ProjectFileRow>(
    `select pf.id, pf.project_id, pf.user_id, pf.filename, pf.file_type,
            pf.file_size, pf.storage_bucket, pf.storage_path, pf.content_hash,
            pf.status, pf.error_message, pf.metadata, pf.created_at, pf.updated_at
     from public.project_files pf
     join public.projects p on p.id = pf.project_id
     where pf.project_id = $1 and p.user_id = $2 and p.status = 'active'
     order by pf.created_at desc`,
    [projectId, userId],
  );
}

export async function getProjectFile(
  fileId: string,
  projectId: string,
  userId: string,
) {
  return queryOne<ProjectFileRow>(
    `select pf.id, pf.project_id, pf.user_id, pf.filename, pf.file_type,
            pf.file_size, pf.storage_bucket, pf.storage_path, pf.content_hash,
            pf.status, pf.error_message, pf.metadata, pf.created_at, pf.updated_at
     from public.project_files pf
     join public.projects p on p.id = pf.project_id
     where pf.id = $1 and pf.project_id = $2 and p.user_id = $3 and p.status = 'active'`,
    [fileId, projectId, userId],
  );
}

export async function createProjectFile(input: {
  projectId: string;
  userId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  storageBucket: string;
  storagePath: string;
  contentHash?: string | null;
}) {
  return queryOne<ProjectFileRow>(
    `insert into public.project_files (
       project_id, user_id, filename, file_type, file_size,
       storage_bucket, storage_path, content_hash, status
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'processing')
     returning id, project_id, user_id, filename, file_type, file_size,
               storage_bucket, storage_path, content_hash, status, error_message,
               metadata, created_at, updated_at`,
    [
      input.projectId,
      input.userId,
      input.filename,
      input.fileType,
      input.fileSize,
      input.storageBucket,
      input.storagePath,
      input.contentHash ?? null,
    ],
  );
}

export async function updateProjectFileStatus(
  fileId: string,
  status: string,
  errorMessage?: string | null,
) {
  return queryOne<ProjectFileRow>(
    `update public.project_files
     set status = $2, error_message = $3, updated_at = now()
     where id = $1
     returning id, project_id, user_id, filename, file_type, file_size,
               storage_bucket, storage_path, content_hash, status, error_message,
               metadata, created_at, updated_at`,
    [fileId, status, errorMessage ?? null],
  );
}

export async function deleteProjectFile(fileId: string, projectId: string, userId: string) {
  return queryOne<{ id: string; storage_bucket: string; storage_path: string }>(
    `delete from public.project_files pf
     using public.projects p
     where pf.id = $1 and pf.project_id = $2 and p.id = pf.project_id
       and p.user_id = $3 and p.status = 'active'
     returning pf.id, pf.storage_bucket, pf.storage_path`,
    [fileId, projectId, userId],
  );
}
