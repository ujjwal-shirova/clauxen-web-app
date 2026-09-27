import { getObject } from "@/server/storage/object-store";
import type { StoragePurpose } from "@/server/storage/object-store";
import { queryOne } from "@/server/db/pool";
import { extractTextFromBuffer } from "@/server/services/text-extract.service";

const DEFAULT_LIMIT = 4_000;
const MAX_LIMIT = 8_000;

type FileRow = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  status: string;
};

function purposeFor(mime: string | null, bucket: string): StoragePurpose {
  if (bucket.includes("attachment") || mime?.startsWith("video/")) return "attachments";
  if (mime?.startsWith("image/")) return "images";
  return "documents";
}

function isImage(mime: string | null) {
  return Boolean(mime?.startsWith("image/"));
}

export async function readUserAttachment(input: {
  userId: string;
  fileId: string;
  offset?: number;
  limit?: number;
}) {
  const file = await queryOne<FileRow>(
    `select id, original_name, mime_type, size_bytes, storage_bucket, storage_path, status
     from public.user_files
     where id = $1 and user_id = $2 and status != 'deleted'`,
    [input.fileId, input.userId],
  );
  if (!file) {
    return { error: "File not found." };
  }

  if (isImage(file.mime_type)) {
    return {
      kind: "image" as const,
      fileId: file.id,
      name: file.original_name,
      mimeType: file.mime_type,
      note: "Image is attached for this step only. Describe or use it, then stop referring to the pixels.",
    };
  }

  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT)),
  );

  let bytes: Buffer;
  try {
    bytes = await getObject(
      purposeFor(file.mime_type, file.storage_bucket),
      file.storage_path,
      file.storage_bucket,
    );
  } catch {
    return { error: "Could not load the stored file." };
  }

  let text = "";
  try {
    text = await extractTextFromBuffer(bytes, file.original_name);
  } catch {
    text = "";
  }
  if (!text.trim() || text.includes("\u0000")) {
    return {
      kind: "binary" as const,
      fileId: file.id,
      name: file.original_name,
      mimeType: file.mime_type,
      sizeBytes: Number(file.size_bytes) || bytes.length,
      note: "No text could be extracted. Use execute_code only if you already know the format.",
    };
  }

  const slice = text.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  return {
    kind: "text" as const,
    fileId: file.id,
    name: file.original_name,
    mimeType: file.mime_type,
    offset,
    nextOffset: nextOffset < text.length ? nextOffset : null,
    totalChars: text.length,
    text: slice,
  };
}
