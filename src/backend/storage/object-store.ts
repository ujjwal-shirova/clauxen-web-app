import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import {
  env,
  getR2S3Endpoint,
  isR2Configured,
  requireR2InProduction,
} from "@/backend/config/env";

/** Logical storage targets — resolved to bucket names via env at runtime. */
export type StoragePurpose =
  | "images"
  | "documents"
  | "artifacts"
  | "skills"
  | "chat-archives";

export type StoredObjectRef = {
  purpose: StoragePurpose;
  bucket: string;
  key: string;
  contentHash?: string;
};

const PURPOSE_BUCKET: Record<StoragePurpose, () => string> = {
  images: () => env.r2ImagesBucket,
  documents: () => env.r2DocumentsBucket,
  artifacts: () => env.r2ArtifactsBucket,
  skills: () => env.r2SkillsBucket,
  "chat-archives": () => env.r2ChatArchivesBucket,
};

export function bucketForPurpose(purpose: StoragePurpose): string {
  return PURPOSE_BUCKET[purpose]();
}

let r2Client: S3Client | null | undefined;

function getR2Client(): S3Client | null {
  if (r2Client !== undefined) return r2Client;
  if (!isR2Configured()) {
    r2Client = null;
    return null;
  }
  r2Client = new S3Client({
    region: "auto",
    endpoint: getR2S3Endpoint(),
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  });
  return r2Client;
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export { isR2Configured };

export async function putObject(input: {
  purpose: StoragePurpose;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<StoredObjectRef> {
  requireR2InProduction();
  const bucket = bucketForPurpose(input.purpose);
  const client = getR2Client();
  const body =
    typeof input.body === "string"
      ? Buffer.from(input.body, "utf8")
      : Buffer.from(input.body);
  const contentHash = hashBuffer(body);

  if (!client) {
    const { writeLocalObject } = await import("@/backend/storage/local-fallback");
    await writeLocalObject(bucket, input.key, body);
    return {
      purpose: input.purpose,
      bucket,
      key: input.key,
      contentHash,
    };
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: body,
      ContentType: input.contentType,
      Metadata: input.metadata,
    }),
  );

  return {
    purpose: input.purpose,
    bucket,
    key: input.key,
    contentHash,
  };
}

export async function getObject(
  purpose: StoragePurpose,
  key: string,
  bucketOverride?: string,
): Promise<Buffer> {
  const bucket = bucketOverride ?? bucketForPurpose(purpose);
  const client = getR2Client();
  if (!client) {
    const { readLocalObject } = await import("@/backend/storage/local-fallback");
    return readLocalObject(bucket, key);
  }

  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Object not found: ${bucket}/${key}`);
  return Buffer.from(bytes);
}

export async function deleteObject(
  purpose: StoragePurpose,
  key: string,
  bucketOverride?: string,
) {
  const bucket = bucketOverride ?? bucketForPurpose(purpose);
  const client = getR2Client();
  if (!client) {
    const { deleteLocalObject } = await import("@/backend/storage/local-fallback");
    await deleteLocalObject(bucket, key);
    return;
  }
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function buildProjectFileKey(
  userId: string,
  projectId: string,
  filename: string,
) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ts = Date.now();
  return `users/${userId}/projects/${projectId}/${ts}-${safe}`;
}

export function buildUserLibraryKey(userId: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `users/${userId}/library/${Date.now()}-${safe}`;
}

export function buildImageKey(userId: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `users/${userId}/images/${Date.now()}-${safe}`;
}

export function buildChatArchiveKey(userId: string, chatId: string) {
  return `users/${userId}/chats/${chatId}/archive.json`;
}

export function buildArtifactKey(
  userId: string,
  artifactId: string,
  filename: string,
) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `users/${userId}/artifacts/${artifactId}/${safe}`;
}

/** Folder prefix for a user skill package in R2. */
export function buildSkillPrefix(userId: string, skillId: string) {
  return `users/${userId}/skills/${skillId}`;
}

export function buildSkillObjectKey(
  userId: string,
  skillId: string,
  relativePath: string,
) {
  const safe = relativePath.replace(/^\/+/, "").replace(/\.\./g, "_");
  return `${buildSkillPrefix(userId, skillId)}/${safe}`;
}

/** Direct-to-R2 upload URL (S3-compatible). Prefer Worker when WORKER_URL is set. */
export async function createPresignedPutUrl(input: {
  purpose: StoragePurpose;
  key: string;
  contentType?: string;
  expiresInSeconds?: number;
  bucketOverride?: string;
}): Promise<{ uploadUrl: string; bucket: string; key: string; expiresAt: string } | null> {
  const client = getR2Client();
  if (!client) return null;
  const bucket = input.bucketOverride ?? bucketForPurpose(input.purpose);
  const expiresIn = input.expiresInSeconds ?? 900;
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
    }),
    { expiresIn },
  );
  return {
    uploadUrl,
    bucket,
    key: input.key,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

export async function createPresignedGetUrl(input: {
  purpose: StoragePurpose;
  key: string;
  expiresInSeconds?: number;
  bucketOverride?: string;
}): Promise<{ downloadUrl: string; expiresAt: string } | null> {
  const client = getR2Client();
  if (!client) return null;
  const bucket = input.bucketOverride ?? bucketForPurpose(input.purpose);
  const expiresIn = input.expiresInSeconds ?? 900;
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const downloadUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: input.key }),
    { expiresIn },
  );
  return {
    downloadUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}
