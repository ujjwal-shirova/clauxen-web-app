import type {
  ChatCompletionContentPart,
  ChatCompletionContentPartImage,
} from "openai/resources/chat/completions/completions";
import { getObject } from "@/server/storage/object-store";
import type { StoragePurpose } from "@/server/storage/object-store";
import { query } from "@/server/db/pool";

const MAX_VISION_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export type ClientVisionImage = {
  mimeType: string;
  /** Raw base64 (no data: prefix) or a full data URL. */
  data: string;
  name?: string;
};

type UserFileImageRow = {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
};

function normalizeMime(mime: string | null | undefined): string | null {
  if (!mime) return null;
  const cleaned = mime.trim().toLowerCase();
  if (cleaned === "image/jpg") return "image/jpeg";
  return ALLOWED_IMAGE_MIME.has(cleaned) ? cleaned : null;
}

function stripDataUrl(data: string): { mime: string | null; base64: string } {
  const trimmed = data.trim();
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(trimmed);
  if (match) {
    return { mime: normalizeMime(match[1]), base64: match[2]!.replace(/\s/g, "") };
  }
  return { mime: null, base64: trimmed.replace(/\s/g, "") };
}

function purposeForMime(mime: string): StoragePurpose {
  return mime.startsWith("image/") ? "images" : "documents";
}

/**
 * Load image bytes for OpenAI-compatible Chat Completions multimodal input.
 * Prefers client-provided base64 (fast path); falls back to R2 via fileIds.
 */
export async function resolveVisionImageBlocks(input: {
  userId: string;
  fileIds?: string[];
  clientImages?: ClientVisionImage[];
}): Promise<ChatCompletionContentPartImage[]> {
  const blocks: ChatCompletionContentPartImage[] = [];
  const seen = new Set<string>();

  for (const image of input.clientImages ?? []) {
    const mime = normalizeMime(image.mimeType) ?? stripDataUrl(image.data).mime;
    if (!mime) continue;
    const { base64 } = stripDataUrl(image.data);
    if (!base64 || base64.length > MAX_VISION_BYTES * 1.4) continue;
    const key = `client:${base64.slice(0, 64)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${base64}`, detail: "auto" },
    });
  }

  const fileIds = (input.fileIds ?? []).filter(Boolean);
  if (fileIds.length === 0) return blocks;

  const files = await query<UserFileImageRow>(
    `select id, original_name, mime_type, size_bytes, storage_bucket, storage_path
     from public.user_files
     where user_id = $1
       and id = any($2::uuid[])
       and status != 'deleted'`,
    [input.userId, fileIds],
  );

  for (const file of files) {
    const mime = normalizeMime(file.mime_type);
    if (!mime) continue;
    if (Number(file.size_bytes) > MAX_VISION_BYTES) continue;
    try {
      const bytes = await getObject(
        purposeForMime(mime),
        file.storage_path,
        file.storage_bucket,
      );
      if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_VISION_BYTES) {
        continue;
      }
      const base64 = Buffer.from(bytes).toString("base64");
      const key = `file:${file.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${base64}`, detail: "auto" },
      });
    } catch {
      // Skip unreadable files — text context still reaches the model.
    }
  }

  return blocks;
}

/**
 * Attach image blocks to the latest user turn for OpenAI-compatible Chat Completions.
 * Text stays as a text block; images are native multimodal parts (not filename stubs).
 */
export function withVisionUserContent(
  text: string,
  images: ChatCompletionContentPartImage[],
): string | ChatCompletionContentPart[] {
  const cleaned = text.trim();
  if (!images.length) return cleaned;

  const parts: ChatCompletionContentPart[] = [];
  for (const image of images) {
    parts.push(image);
  }
  if (cleaned) {
    parts.push({ type: "text", text: cleaned });
  } else {
    parts.push({
      type: "text",
      text: "Please analyze the attached image(s) or video frames.",
    });
  }
  return parts;
}

const MAX_CLIENT_VISION_PARTS = 16;

export type ParsedClientVisionImage = {
  mimeType: string;
  data: string;
  name?: string;
};

/** Parse OpenAI-compatible `image_url` client payloads (Together / Novita). */
export function parseClientVisionImages(
  raw: unknown,
  limit = MAX_CLIENT_VISION_PARTS,
): ParsedClientVisionImage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const parsed: ParsedClientVisionImage[] = [];
  for (const image of raw) {
    if (!image || typeof image !== "object") continue;
    const record = image as Record<string, unknown>;
    const mimeType =
      typeof record.mimeType === "string" ? record.mimeType.trim() : "";
    const data = typeof record.data === "string" ? record.data.trim() : "";
    if (!mimeType || !data) continue;
    parsed.push({
      mimeType,
      data,
      ...(typeof record.name === "string"
        ? { name: record.name.trim().slice(0, 240) }
        : {}),
    });
    if (parsed.length >= limit) break;
  }
  return parsed.length ? parsed : undefined;
}

export function parseVisionFileIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((id): id is string => typeof id === "string" && id.length > 0);
  return ids.length ? ids : undefined;
}

export function applyVisionToLastUserMessage<
  T extends { role: string; content?: unknown },
>(messages: T[], images: ChatCompletionContentPartImage[]): T[] {
  if (!images.length) return messages;
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return messages;
  const current = messages[lastUserIdx]!;
  const text = typeof current.content === "string" ? current.content : "";
  return messages.map((message, index) =>
    index === lastUserIdx
      ? ({ ...message, content: withVisionUserContent(text, images) } as T)
      : message,
  );
}
