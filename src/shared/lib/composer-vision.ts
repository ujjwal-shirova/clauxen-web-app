import type { ComposerAttachment } from "@/lib/composer-attachments";
import { extractVideoFrames } from "@/lib/video-frames";

export type ComposerVisionImage = {
  mimeType: string;
  data: string;
  name?: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

const visionJobs = new Map<string, Promise<ComposerVisionImage[]>>();

async function readAttachmentVision(
  item: ComposerAttachment,
): Promise<ComposerVisionImage[]> {
  if (item.kind === "image") {
    const mimeType = item.mimeType || "image/jpeg";
    let dataUrl =
      typeof item.previewUrl === "string" &&
      item.previewUrl.startsWith("data:")
        ? item.previewUrl
        : "";
    if (!dataUrl && item.file) {
      try {
        dataUrl = await readFileAsDataUrl(item.file);
      } catch {
        return [];
      }
    }
    if (!dataUrl) return [];
    return [{ mimeType, data: dataUrl, name: item.name }];
  }
  if (item.kind === "video" && item.file) {
    try {
      return await extractVideoFrames(item.file);
    } catch {
      return [];
    }
  }
  return [];
}

/** Decode images / sample video frames while the file is still attaching. */
export function prefetchComposerVision(
  item: ComposerAttachment,
): Promise<ComposerVisionImage[]> {
  const existing = visionJobs.get(item.id);
  if (existing) return existing;
  const job = readAttachmentVision(item);
  visionJobs.set(item.id, job);
  return job;
}

/**
 * Build OpenAI-compatible vision parts from composer / edit attachments.
 * Images go through as `image_url` data URIs. Videos are sampled into JPEG
 * stills — Chat Completions (Together / Novita) cannot take raw video bytes.
 */
export async function collectComposerVision(
  attachments: ComposerAttachment[],
): Promise<{
  images: ComposerVisionImage[];
  fileIds: string[];
  /** Image fileIds that still need a server R2 fetch (no local pixels). */
  remoteFileIds: string[];
}> {
  const images: ComposerVisionImage[] = [];
  const fileIds: string[] = [];
  const remoteFileIds: string[] = [];

  for (const item of attachments) {
    if (item.fileId && !fileIds.includes(item.fileId)) {
      fileIds.push(item.fileId);
    }
    const frames = await prefetchComposerVision(item);
    if (frames.length) {
      images.push(...frames);
      continue;
    }
    if (
      item.fileId &&
      item.kind === "image" &&
      !remoteFileIds.includes(item.fileId)
    ) {
      remoteFileIds.push(item.fileId);
    }
  }

  return { images, fileIds, remoteFileIds };
}

export function attachmentContextLines(
  attachments: ComposerAttachment[],
): string {
  if (attachments.length === 0) return "";
  return [
    "",
    "[Attached files]",
    ...attachments.map((item) => {
      if (item.kind === "document" && item.textPreview) {
        return `- ${item.name}:\n${item.textPreview.slice(0, 8000)}`;
      }
      if (item.kind === "image") {
        return `- ${item.name} (image attached for vision)`;
      }
      if (item.kind === "video") {
        return `- ${item.name} (video attached; sampled frames sent for vision)`;
      }
      return `- ${item.name} (${item.mimeType || item.kind})`;
    }),
  ].join("\n");
}
