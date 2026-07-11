import { createHash, randomUUID } from "node:crypto";
import { AppError, notFound } from "@/backend/db/errors";
import { env } from "@/backend/config/env";
import * as userFilesRepo from "@/backend/repositories/user-files.repository";
import * as billingRepo from "@/backend/repositories/billing.repository";
import {
  resolveActiveStoragePlanId,
  storageQuotaBytesForPlan,
} from "@/lib/storage-quota";
import {
  bucketForPurpose,
  buildImageKey,
  buildUserLibraryKey,
  type StoragePurpose,
} from "@/backend/storage/object-store";

const PRESIGN_TTL_SECONDS = 900;
const MAX_FILE_BYTES = 100 * 1024 * 1024;

function purposeForMime(mimeType?: string | null): StoragePurpose {
  return mimeType?.startsWith("image/") ? "images" : "documents";
}

function buildStorageKey(userId: string, filename: string, mimeType?: string | null) {
  return mimeType?.startsWith("image/")
    ? buildImageKey(userId, filename)
    : buildUserLibraryKey(userId, filename);
}

/** ponytail: presign URLs use Worker when WORKER_URL set, else stub fallback. */
function buildPresignStub(input: {
  bucket: string;
  key: string;
  method?: string;
}) {
  const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString();
  if (env.workerUrl) {
    const base = env.workerUrl.replace(/\/+$/, "");
    return {
      method: input.method ?? "PUT",
      uploadUrl: `${base}/upload/presign`,
      downloadUrl: `${base}/download/${encodeURIComponent(input.key)}?bucket=${encodeURIComponent(input.bucket)}`,
      expiresAt,
      stub: false,
      worker: true,
    };
  }
  const base = env.r2PublicBaseUrl || env.appUrl;
  return {
    method: input.method ?? "PUT",
    uploadUrl: `${base}/api/v1/files/stub-upload?bucket=${encodeURIComponent(input.bucket)}&key=${encodeURIComponent(input.key)}`,
    downloadUrl: `${base}/api/v1/files/stub-download?bucket=${encodeURIComponent(input.bucket)}&key=${encodeURIComponent(input.key)}`,
    expiresAt,
    stub: true,
  };
}

export async function presignUserFileUpload(
  userId: string,
  input: {
    originalName: string;
    mimeType?: string | null;
    sizeBytes?: number;
    workspaceId?: string | null;
    projectId?: string | null;
  },
) {
  const originalName = input.originalName.trim();
  if (!originalName) {
    throw new AppError("originalName is required.", 400);
  }
  if (input.sizeBytes && input.sizeBytes > MAX_FILE_BYTES) {
    throw new AppError("File exceeds 100 MB limit.", 400);
  }

  const purpose = purposeForMime(input.mimeType);
  const bucket = bucketForPurpose(purpose);
  const storagePath = buildStorageKey(userId, originalName, input.mimeType);

  const file = await userFilesRepo.createUserFile({
    userId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    originalName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes ?? 0,
    storageBucket: bucket,
    storagePath,
    status: "pending",
    metadata: { purpose },
  });

  if (!file) throw new AppError("Failed to create file record.", 500);

  const presign = buildPresignStub({ bucket, key: storagePath });

  return {
    fileId: file.id,
    storageBucket: bucket,
    storagePath,
    purpose,
    ...presign,
  };
}

export async function completeUserFileUpload(
  userId: string,
  input: {
    fileId: string;
    contentHash?: string | null;
    sizeBytes?: number;
  },
) {
  const file = await userFilesRepo.updateUserFile(input.fileId, userId, {
    status: "uploaded",
    contentHash: input.contentHash ?? null,
    sizeBytes: input.sizeBytes,
  });
  if (!file) throw notFound("File not found.");
  return file;
}

export async function getUserFileDownloadUrl(userId: string, fileId: string) {
  const file = await userFilesRepo.getUserFile(fileId, userId);
  if (!file) throw notFound("File not found.");

  const purpose = file.mime_type?.startsWith("image/") ? "images" : "documents";
  const presign = buildPresignStub({
    bucket: file.storage_bucket,
    key: file.storage_path,
    method: "GET",
  });

  return {
    fileId: file.id,
    url: presign.downloadUrl,
    expiresAt: presign.expiresAt,
    mimeType: file.mime_type,
    originalName: file.original_name,
    stub: presign.stub,
  };
}

export async function getUserStorageSummary(userId: string) {
  const [stats, subscription] = await Promise.all([
    userFilesRepo.getUserFileStorageStats(userId),
    billingRepo.getUserSubscription(userId),
  ]);
  const totalBytes = Number(stats?.total_bytes ?? 0);
  const planId = resolveActiveStoragePlanId(subscription);
  const quotaBytes = storageQuotaBytesForPlan(planId);

  return {
    usedBytes: totalBytes,
    quotaBytes,
    categories: [
      {
        id: "files",
        title: "Files",
        bytes: Number(stats?.document_bytes ?? 0),
        count: Number(stats?.document_count ?? 0),
      },
      {
        id: "images",
        title: "Images",
        bytes: Number(stats?.image_bytes ?? 0),
        count: Number(stats?.image_count ?? 0),
      },
    ],
  };
}

export function hashFileContent(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function newFileId() {
  return randomUUID();
}
