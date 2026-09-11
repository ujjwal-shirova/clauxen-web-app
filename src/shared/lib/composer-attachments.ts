/** Shared composer / message attachment types and allowlists. */

export type ComposerAttachmentKind = "image" | "document" | "video";

export type ComposerAttachment = {
  id: string;
  name: string;
  mimeType: string;
  kind: ComposerAttachmentKind;
  /** Local object URL or remote URL for chip / lightbox. */
  previewUrl: string;
  /** Browser File before/during upload. */
  file?: File;
  fileId?: string;
  /** Short text snippet for document chips / modal (txt/md/csv/json). */
  textPreview?: string;
  uploadStatus?: "local" | "uploading" | "ready" | "error";
  errorMessage?: string;
};

/** Persisted / displayed attachment on a chat Message. */
export type MessageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  kind: ComposerAttachmentKind;
  previewUrl?: string;
  fileId?: string;
  textPreview?: string;
};

export type SendMessageOptions = {
  attachments?: ComposerAttachment[];
  /** Skip the per-chat generating queue (ask_user_input answers). */
  bypassQueue?: boolean;
};

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const TEXT_EXT = new Set(["txt", "md", "markdown", "csv", "json"]);
const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/csv",
]);

export const COMPOSER_FILE_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v,.txt,.md,.markdown,.csv,.json,application/pdf,.pdf,text/plain,text/markdown,text/csv,application/json";

export function extensionOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
}

export function classifyComposerFile(
  file: File,
): ComposerAttachmentKind | null {
  const mime = (file.type || "").toLowerCase();
  const ext = extensionOf(file.name);

  if (IMAGE_MIMES.has(mime) || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return "image";
  }
  if (
    VIDEO_MIMES.has(mime) ||
    ["mp4", "webm", "mov", "m4v"].includes(ext)
  ) {
    return "video";
  }
  if (
    mime === "application/pdf" ||
    ext === "pdf" ||
    TEXT_MIMES.has(mime) ||
    TEXT_EXT.has(ext)
  ) {
    return "document";
  }
  return null;
}

export function kindFromMime(
  mimeType?: string | null,
  name = "",
): ComposerAttachmentKind {
  const mime = (mimeType || "").toLowerCase();
  const ext = extensionOf(name);
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return "image";
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext)) {
    return "video";
  }
  return "document";
}

export function isTextDocument(file: {
  name: string;
  mimeType?: string;
}): boolean {
  const mime = (file.mimeType || "").toLowerCase();
  const ext = extensionOf(file.name);
  return TEXT_MIMES.has(mime) || TEXT_EXT.has(ext);
}

export function isPdfDocument(file: {
  name: string;
  mimeType?: string;
}): boolean {
  const mime = (file.mimeType || "").toLowerCase();
  return mime === "application/pdf" || extensionOf(file.name) === "pdf";
}

export function documentTypeLabel(file: {
  name: string;
  mimeType?: string;
  kind?: ComposerAttachmentKind;
}): string {
  if (file.kind === "video") return "VIDEO";
  if (isPdfDocument(file)) return "PDF";
  const ext = extensionOf(file.name).toUpperCase();
  if (ext) return ext;
  return "DOC";
}

/** Read a short preview for text-based documents (cap ~64KB). */
export async function readTextPreview(
  file: File,
  maxChars = 64_000,
): Promise<string> {
  if (!isTextDocument({ name: file.name, mimeType: file.type })) {
    return "";
  }
  const text = await file.text();
  return text.length > maxChars
    ? `${text.slice(0, maxChars)}\n\n[truncated]`
    : text;
}

export function toMessageAttachments(
  attachments: ComposerAttachment[],
): MessageAttachment[] {
  return attachments.map((item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    kind: item.kind,
    previewUrl: item.previewUrl,
    fileId: item.fileId,
    textPreview: item.textPreview,
  }));
}

export function filePreviewSrc(file: {
  previewUrl?: string;
  fileId?: string;
}): string | undefined {
  if (file.previewUrl) return file.previewUrl;
  if (file.fileId) return `/api/v1/files/${file.fileId}/url?redirect=1`;
  return undefined;
}
