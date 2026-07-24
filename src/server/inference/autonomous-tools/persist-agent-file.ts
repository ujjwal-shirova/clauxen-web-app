import { randomUUID } from "node:crypto";
import * as userFilesRepo from "@/server/repositories/user-files.repository";
import {
  buildArtifactKey,
  bucketForPurpose,
  putObject,
} from "@/server/storage/object-store";

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
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
  return "text/plain";
}

/**
 * Persist an agent-created workspace file to R2 + user_files so the user can
 * fetch/download it later (Supabase row → R2 object).
 */
export async function persistAgentCreatedFile(input: {
  userId: string;
  chatId: string;
  path: string;
  content: string;
}): Promise<{ fileId: string; storagePath: string } | null> {
  const userId = input.userId.trim();
  const path = input.path.trim().replace(/^\/+/, "");
  if (!userId || !path) return null;

  const fileName = path.split("/").pop() || "file.txt";
  const artifactId = randomUUID();
  const storagePath = buildArtifactKey(userId, artifactId, fileName);
  const body = Buffer.from(input.content ?? "", "utf8");
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
      source: "create_file",
    },
  });

  if (!file) return null;
  return { fileId: file.id, storagePath: stored.key };
}
