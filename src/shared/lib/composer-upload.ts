import { uploadUserFile } from "@/lib/api/files";
import type { ComposerAttachment } from "@/lib/composer-attachments";
import { prefetchComposerVision } from "@/lib/composer-vision";

const uploadJobs = new Map<string, Promise<string | null>>();
const cancelledIds = new Set<string>();

export function cancelComposerAttachment(id: string) {
  cancelledIds.add(id);
}

/**
 * Start R2 upload + vision prefetch as soon as a file is attached so Send
 * does not wait on storage. Chip overlay uses uploadStatus === "uploading".
 */
export function beginComposerAttachmentWork(
  item: ComposerAttachment,
  options: {
    chatId?: string | null;
    skipUpload?: boolean;
    onUpdate: (id: string, patch: Partial<ComposerAttachment>) => void;
  },
) {
  cancelledIds.delete(item.id);
  void prefetchComposerVision(item);
  if (options.skipUpload || item.fileId || !item.file) {
    if (item.fileId) {
      options.onUpdate(item.id, { uploadStatus: "ready", fileId: item.fileId });
    }
    return;
  }
  options.onUpdate(item.id, {
    uploadStatus: "uploading",
    errorMessage: undefined,
  });
  void queueComposerUpload(item, options);
}

export function queueComposerUpload(
  item: ComposerAttachment,
  options: {
    chatId?: string | null;
    onUpdate: (id: string, patch: Partial<ComposerAttachment>) => void;
  },
): Promise<string | null> {
  if (item.fileId) return Promise.resolve(item.fileId);
  const existing = uploadJobs.get(item.id);
  if (existing) return existing;
  if (!item.file) return Promise.resolve(null);

  const job = uploadUserFile(item.file, {
    purpose: "chat-attachment",
    chatId: options.chatId,
  })
    .then((fileId) => {
      if (!cancelledIds.has(item.id)) {
        options.onUpdate(item.id, {
          fileId,
          uploadStatus: "ready",
          errorMessage: undefined,
        });
      }
      return fileId;
    })
    .catch((error: unknown) => {
      if (!cancelledIds.has(item.id)) {
        options.onUpdate(item.id, {
          uploadStatus: "error",
          errorMessage:
            error instanceof Error ? error.message : "Upload failed",
        });
      }
      return null;
    })
    .finally(() => {
      uploadJobs.delete(item.id);
    });

  uploadJobs.set(item.id, job);
  return job;
}

/** Resolve fileIds for send. Reuses in-flight attach uploads — never double-PUTs. */
export async function settleComposerUploads(
  attachments: ComposerAttachment[],
  options: { chatId?: string | null },
): Promise<ComposerAttachment[]> {
  if (attachments.length === 0) return attachments;
  return Promise.all(
    attachments.map(async (item) => {
      if (item.fileId) {
        return { ...item, uploadStatus: "ready" as const };
      }
      if (!item.file) return item;
      const fileId = await queueComposerUpload(item, {
        chatId: options.chatId,
        onUpdate: () => {},
      });
      if (!fileId) {
        return { ...item, uploadStatus: "error" as const };
      }
      return { ...item, fileId, uploadStatus: "ready" as const };
    }),
  );
}
