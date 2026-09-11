import { createHash, randomUUID } from "node:crypto";
import { AppError, notFound } from "@/server/db/errors";
import { env, isR2Configured } from "@/server/config/env";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import * as billingRepo from "@/server/repositories/billing.repository";
import {
  resolveActiveStoragePlanId,
  storageQuotaBytesForPlan,
} from "@/lib/storage-quota";
import {
  bucketForPurpose,
  buildImageKey,
  buildProjectFileKey,
  buildUserAttachmentKey,
  buildUserLibraryKey,
  createPresignedGetUrl,
  createPresignedPutUrl,
  type StoragePurpose,
} from "@/server/storage/object-store";

const PRESIGN_TTL_SECONDS = 900;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const AVATAR_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function buildAvatarKey(userId: string, originalName: string) {
  const ext = (originalName.split(".").pop() || "png").toLowerCase();
  return `avatars/${userId}/${randomUUID()}.${ext}`;
}

function purposeForMime(mimeType?: string | null): StoragePurpose {
  if (mimeType?.startsWith("image/")) return "images";
  if (mimeType?.startsWith("video/")) return "attachments";
  return "documents";
}

function buildStorageKey(
  userId: string,
  filename: string,
  mimeType?: string | null,
  folderId?: string | null,
) {
  if (mimeType?.startsWith("video/")) {
    return buildUserAttachmentKey(userId, filename);
  }
  return mimeType?.startsWith("image/")
    ? buildImageKey(userId, filename, folderId)
    : buildUserLibraryKey(userId, filename, folderId);
}

/**
 * Product uploads go through clauxen-r2-gateway only.
 * Direct S3 presign is local/dev fallback; production requires WORKER_URL.
 * Vercel Blob and Supabase Storage are not used for chat binaries.
 */
async function buildUploadPresign(input: {
  purpose: StoragePurpose;
  bucket: string;
  key: string;
  contentType?: string | null;
}) {
  const expiresAt = new Date(
    Date.now() + PRESIGN_TTL_SECONDS * 1000,
  ).toISOString();

  if (env.workerUrl) {
    const base = env.workerUrl.replace(/\/+$/, "");
    return {
      method: "PUT" as const,
      uploadUrl: `${base}/upload/put?bucket=${encodeURIComponent(input.bucket)}&key=${encodeURIComponent(input.key)}`,
      downloadUrl: `${base}/download/${encodeURIComponent(input.key)}?bucket=${encodeURIComponent(input.bucket)}`,
      expiresAt,
      stub: false,
      worker: true,
    };
  }

  if (env.isProduction) {
    throw new AppError(
      "File uploads require WORKER_URL (clauxen-r2-gateway). Direct R2/Blob paths are disabled in production.",
      503,
      "storage_worker_required",
    );
  }

  if (isR2Configured()) {
    const put = await createPresignedPutUrl({
      purpose: input.purpose,
      key: input.key,
      contentType: input.contentType ?? undefined,
      expiresInSeconds: PRESIGN_TTL_SECONDS,
      bucketOverride: input.bucket,
    });
    const get = await createPresignedGetUrl({
      purpose: input.purpose,
      key: input.key,
      expiresInSeconds: PRESIGN_TTL_SECONDS,
      bucketOverride: input.bucket,
    });
    if (put && get) {
      return {
        method: "PUT" as const,
        uploadUrl: put.uploadUrl,
        downloadUrl: get.downloadUrl,
        expiresAt: put.expiresAt,
        stub: false,
        worker: false,
      };
    }
  }

  const base = env.r2PublicBaseUrl || env.appUrl;
  return {
    method: "PUT" as const,
    uploadUrl: `${base}/api/v1/files/stub-upload?bucket=${encodeURIComponent(input.bucket)}&key=${encodeURIComponent(input.key)}`,
    downloadUrl: `${base}/api/v1/files/stub-download?bucket=${encodeURIComponent(input.bucket)}&key=${encodeURIComponent(input.key)}`,
    expiresAt,
    stub: true,
    worker: false,
  };
}

async function buildDownloadPresign(input: {
  purpose: StoragePurpose;
  bucket: string;
  key: string;
}) {
  if (env.workerUrl) {
    const base = env.workerUrl.replace(/\/+$/, "");
    return {
      downloadUrl: `${base}/download/${encodeURIComponent(input.key)}?bucket=${encodeURIComponent(input.bucket)}`,
      expiresAt: new Date(
        Date.now() + PRESIGN_TTL_SECONDS * 1000,
      ).toISOString(),
      stub: false,
    };
  }

  if (env.isProduction) {
    throw new AppError(
      "File downloads require WORKER_URL (clauxen-r2-gateway).",
      503,
      "storage_worker_required",
    );
  }

  if (isR2Configured()) {
    const get = await createPresignedGetUrl({
      purpose: input.purpose,
      key: input.key,
      expiresInSeconds: PRESIGN_TTL_SECONDS,
      bucketOverride: input.bucket,
    });
    if (get) {
      return {
        downloadUrl: get.downloadUrl,
        expiresAt: get.expiresAt,
        stub: false,
      };
    }
  }

  const base = env.r2PublicBaseUrl || env.appUrl;
  return {
    downloadUrl: `${base}/api/v1/files/stub-download?bucket=${encodeURIComponent(input.bucket)}&key=${encodeURIComponent(input.key)}`,
    expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString(),
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
    folderId?: string | null;
    purpose?: "avatar" | "library" | "chat-attachment";
    chatId?: string | null;
  },
) {
  const originalName = input.originalName.trim();
  if (!originalName) {
    throw new AppError("originalName is required.", 400);
  }

  if (input.folderId) {
    const folder = await userFilesRepo.getLibraryFolder(input.folderId, userId);
    if (!folder) throw notFound("Folder not found.");
  }

  if (input.projectId) {
    const { getProject } =
      await import("@/server/repositories/projects.repository");
    const project = await getProject(input.projectId, userId);
    if (!project) throw notFound("Project not found.");
  }

  const isAvatar = input.purpose === "avatar";
  const isChatAttachment = input.purpose === "chat-attachment";
  const mime = (input.mimeType ?? "").toLowerCase();
  if (isAvatar) {
    if (!AVATAR_MIMES.has(mime)) {
      throw new AppError(
        "Avatar must be PNG, JPEG, WebP, or GIF.",
        400,
        "invalid_avatar_type",
      );
    }
    if (input.sizeBytes && input.sizeBytes > MAX_AVATAR_BYTES) {
      throw new AppError("Avatar exceeds 2 MB limit.", 400);
    }
  } else if (input.sizeBytes && input.sizeBytes > MAX_FILE_BYTES) {
    throw new AppError("File exceeds 100 MB limit.", 400);
  }

  const purpose = isAvatar
    ? "images"
    : isChatAttachment
      ? "attachments"
      : purposeForMime(input.mimeType);
  const bucket = bucketForPurpose(purpose);
  const storagePath = isAvatar
    ? buildAvatarKey(userId, originalName)
    : isChatAttachment
      ? buildUserAttachmentKey(userId, originalName, input.chatId)
      : input.projectId
        ? buildProjectFileKey(userId, input.projectId, originalName)
        : buildStorageKey(userId, originalName, input.mimeType, input.folderId);

  const file = await userFilesRepo.createUserFile({
    userId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    folderId: input.folderId,
    originalName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes ?? 0,
    storageBucket: bucket,
    storagePath,
    status: "pending",
    metadata: {
      purpose: isAvatar
        ? "avatar"
        : isChatAttachment
          ? "chat-attachment"
          : purpose,
      ...(input.projectId ? { projectKnowledge: true } : {}),
      ...(input.chatId ? { chatId: input.chatId } : {}),
    },
  });

  if (!file) throw new AppError("Failed to create file record.", 500);

  const presign = await buildUploadPresign({
    purpose,
    bucket,
    key: storagePath,
    contentType: input.mimeType,
  });

  const stored = await userFilesRepo.updateUserFile(file.id, userId, {
    storageUrl: presign.downloadUrl,
    metadata: {
      ...(file.metadata ?? {}),
      storageUrl: presign.downloadUrl,
    },
  });

  return {
    fileId: file.id,
    storageBucket: bucket,
    storagePath,
    storageUrl: stored?.storage_url ?? presign.downloadUrl,
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

  const metaPurpose =
    file.metadata && typeof file.metadata.purpose === "string"
      ? file.metadata.purpose
      : "";
  const purpose: StoragePurpose =
    metaPurpose === "chat-attachment" ||
    file.storage_bucket.includes("attachment")
      ? "attachments"
      : file.mime_type?.startsWith("image/")
        ? "images"
        : "documents";
  const presign = await buildDownloadPresign({
    purpose,
    bucket: file.storage_bucket,
    key: file.storage_path,
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
