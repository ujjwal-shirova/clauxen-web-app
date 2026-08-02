import { randomUUID } from "node:crypto";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import {
  buildArtifactKey,
  bucketForPurpose,
  putObject,
} from "@/server/storage/object-store";

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".ts")) {
    return "text/javascript";
  }
  if (lower.endsWith(".py")) return "text/x-python";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

/**
 * Persist an agent-created workspace file to R2 + user_files so the user can
 * fetch/download it later (Supabase row → R2 object).
 */
export async function persistAgentCreatedFile(input: {
  userId: string;
  chatId: string;
  path: string;
  content: string | Uint8Array;
  source?: "create_file" | "sandbox";
}): Promise<{
  fileId: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
} | null> {
  const userId = input.userId.trim();
  const path = input.path.trim().replace(/^\/+/, "");
  if (!userId || !path) return null;

  const fileName = path.split("/").pop() || "file.txt";
  const artifactId = randomUUID();
  const storagePath = buildArtifactKey(userId, artifactId, fileName);
  const body =
    typeof input.content === "string"
      ? Buffer.from(input.content, "utf8")
      : Buffer.from(input.content);
  const mimeType = mimeFromPath(path);

  const stored = await putObject({
    purpose: "artifacts",
    key: storagePath,
    body,
    contentType: mimeType,
    metadata: {
      chatId: input.chatId,
      workspacePath: path,
    },
  });

  const file = await userFilesRepo.createUserFile({
    userId,
    originalName: fileName,
    mimeType,
    sizeBytes: body.byteLength,
    storageBucket: stored.bucket || bucketForPurpose("artifacts"),
    storagePath: stored.key,
    status: "uploaded",
    metadata: {
      purpose: "artifacts",
      chatId: input.chatId,
      workspacePath: path,
      contentHash: stored.contentHash ?? null,
      source: input.source ?? "create_file",
    },
  });

  if (!file) return null;
  return {
    fileId: file.id,
    storagePath: stored.key,
    mimeType,
    sizeBytes: body.byteLength,
  };
}
