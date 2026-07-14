"use client";

import { FileText, X } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import {
  documentTypeLabel,
  type ComposerAttachment,
  type MessageAttachment,
} from "@/frontend/lib/composer-attachments";

type ChipFile = ComposerAttachment | MessageAttachment;

export function AttachmentChip({
  file,
  onRemove,
  onOpen,
  className,
  size = "md",
}: {
  file: ChipFile;
  onRemove?: () => void;
  onOpen?: () => void;
  className?: string;
  /** Collapsed message = sm; composer/default = md; inline edit = lg. */
  size?: "sm" | "md" | "lg";
}) {
  const isImage = file.kind === "image";
  const uploading =
    "uploadStatus" in file && file.uploadStatus === "uploading";
  const errored = "uploadStatus" in file && file.uploadStatus === "error";
  const previewSrc =
    file.previewUrl ||
    (file.fileId ? `/api/v1/files/${file.fileId}/url?redirect=1` : undefined);

  const imageSize =
    size === "lg" ? "h-16 w-16 sm:h-[72px] sm:w-[72px]" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const docSize =
    size === "lg"
      ? "flex h-16 max-w-[200px] items-center gap-2 px-2 pr-2.5 sm:h-[72px]"
      : size === "sm"
        ? "flex h-10 max-w-[140px] items-center gap-1.5 px-1.5 pr-2"
        : "flex h-12 max-w-[160px] items-center gap-1.5 px-1.5 pr-2";
  const docThumb =
    size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-9 w-9";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-zinc-50 text-left transition-colors",
        errored ? "border-red-300" : "border-zinc-200/90 hover:bg-zinc-100/80",
        isImage ? imageSize : docSize,
        className,
      )}
      aria-label={file.name}
    >
      {isImage ? (
        previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt={file.name}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100">
            <FileText className="h-4 w-4 text-zinc-400" />
          </div>
        )
      ) : (
        <>
          <div
            className={cn(
              "flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white",
              docThumb,
            )}
          >
            {file.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.previewUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <FileText className="h-4 w-4 text-zinc-500" />
            )}
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-medium leading-3 text-zinc-800",
                size === "lg" ? "text-[11px]" : "text-[10px]",
              )}
            >
              {file.name}
            </p>
            <p className="mt-0.5 flex items-center gap-0.5 text-[9px] text-zinc-400">
              <FileText className="h-2.5 w-2.5" />
              {documentTypeLabel(file)}
            </p>
          </div>
        </>
      )}

      {uploading ? (
        <span className="absolute inset-0 bg-white/55" aria-hidden />
      ) : null}

      {onRemove ? (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Remove ${file.name}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }
          }}
          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-white opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </button>
  );
}
