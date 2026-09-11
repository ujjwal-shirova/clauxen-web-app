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
}> {
  const images: ComposerVisionImage[] = [];
  const fileIds: string[] = [];

  for (const item of attachments) {
    if (item.fileId && !fileIds.includes(item.fileId)) {
      fileIds.push(item.fileId);
    }
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
          continue;
        }
      }
      if (!dataUrl) continue;
      images.push({ mimeType, data: dataUrl, name: item.name });
      continue;
    }
    if (item.kind === "video" && item.file) {
      const frames = await extractVideoFrames(item.file);
      for (const frame of frames) images.push(frame);
    }
  }

  return { images, fileIds };
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
