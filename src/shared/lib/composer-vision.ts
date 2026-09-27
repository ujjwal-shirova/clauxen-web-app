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
 * File ids only. Pixel and text bodies stay in storage until the model
 * calls read_attachment, so a large upload is not billed as prompt tokens.
 */
export async function collectComposerVision(
  attachments: ComposerAttachment[],
): Promise<{
  images: ComposerVisionImage[];
  fileIds: string[];
  remoteFileIds: string[];
}> {
  const fileIds: string[] = [];
  for (const item of attachments) {
    if (item.fileId && !fileIds.includes(item.fileId)) {
      fileIds.push(item.fileId);
    }
  }
  return { images: [], fileIds, remoteFileIds: [] };
}

export function attachmentContextLines(
  attachments: ComposerAttachment[],
): string {
  if (attachments.length === 0) return "";
  return [
    "",
    "[Attached files]",
    "These files are stored. Their contents are not in this message.",
    "Call read_attachment with file_id to read a slice. Use offset to page through a long file. Do not guess the contents.",
    ...attachments.map((item) => {
      const id = item.fileId ? ` file_id=${item.fileId}` : "";
      const size = item.file ? ` size=${item.file.size}` : "";
      return `- ${item.name}${id} type=${item.mimeType || item.kind}${size}`;
    }),
  ].join("\n");
}
