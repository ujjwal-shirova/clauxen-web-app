import { query, queryOne } from "@/backend/db/pool";

export type DataExportJobRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  status: string;
  export_type: string;
  storage_bucket: string | null;
  storage_path: string | null;
  expires_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type DataDeletionRequestRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  status: string;
  requested_scope: string;
  verified_at: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const EXPORT_LIST_LIMIT = 20;

export async function createDataExportJob(input: {
  userId: string;
  workspaceId?: string | null;
  exportType?: string;
}) {
  return queryOne<DataExportJobRow>(
    `insert into public.data_export_jobs (user_id, workspace_id, export_type, status)
     values ($1, $2, $3, 'queued')
     returning id, user_id, workspace_id, status, export_type, storage_bucket,
               storage_path, expires_at, error_message, created_at, updated_at`,
    [input.userId, input.workspaceId ?? null, input.exportType ?? "account"],
  );
}

export async function listDataExportJobs(userId: string) {
  return query<DataExportJobRow>(
    `select id, user_id, workspace_id, status, export_type, storage_bucket,
            storage_path, expires_at, error_message, created_at, updated_at
     from public.data_export_jobs
     where user_id = $1
     order by created_at desc
     limit $2`,
    [userId, EXPORT_LIST_LIMIT],
  );
}

export async function getDataExportJob(jobId: string, userId: string) {
  return queryOne<DataExportJobRow>(
    `select id, user_id, workspace_id, status, export_type, storage_bucket,
            storage_path, expires_at, error_message, created_at, updated_at
     from public.data_export_jobs
     where id = $1 and user_id = $2`,
    [jobId, userId],
  );
}

export async function createDataDeletionRequest(input: {
  userId: string;
  workspaceId?: string | null;
  requestedScope?: string;
  verificationTokenHash: string;
  metadata?: Record<string, unknown>;
}) {
  return queryOne<DataDeletionRequestRow>(
    `insert into public.data_deletion_requests (
       user_id, workspace_id, requested_scope, verification_token_hash, metadata
     ) values ($1, $2, $3, $4, $5::jsonb)
     returning id, user_id, workspace_id, status, requested_scope, verified_at,
               scheduled_for, completed_at, metadata, created_at`,
    [
      input.userId,
      input.workspaceId ?? null,
      input.requestedScope ?? "account",
      input.verificationTokenHash,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function listDataDeletionRequests(userId: string) {
  return query<DataDeletionRequestRow>(
    `select id, user_id, workspace_id, status, requested_scope, verified_at,
            scheduled_for, completed_at, metadata, created_at
     from public.data_deletion_requests
     where user_id = $1
     order by created_at desc
     limit 10`,
    [userId],
  );
}
