"use client";

import { AttachmentDocumentPreview } from "@/components/composer/attachment-document-preview";
import { AttachmentImageLightbox } from "@/components/composer/attachment-image-lightbox";
import { AttachmentVideoLightbox } from "@/components/composer/attachment-video-lightbox";
import {
  filePreviewSrc,
  type ComposerAttachment,
  type MessageAttachment,
} from "@/lib/composer-attachments";

type PreviewFile = ComposerAttachment | MessageAttachment;

export function AttachmentPreviewHost({
  file,
  onClose,
}: {
  file: PreviewFile | null;
  onClose: () => void;
}) {
  const previewUrl = file ? filePreviewSrc(file) ?? "" : "";
  return (
    <>
      <AttachmentImageLightbox
        open={file?.kind === "image"}
        name={file?.name ?? ""}
        previewUrl={previewUrl}
        onClose={onClose}
      />
      <AttachmentVideoLightbox
        open={file?.kind === "video"}
        name={file?.name ?? ""}
        previewUrl={previewUrl}
        onClose={onClose}
      />
      <AttachmentDocumentPreview
        open={file?.kind === "document"}
        name={file?.name ?? ""}
        mimeType={file?.mimeType ?? ""}
        previewUrl={previewUrl || undefined}
        textPreview={file && "textPreview" in file ? file.textPreview : undefined}
        onClose={onClose}
      />
    </>
  );
}
