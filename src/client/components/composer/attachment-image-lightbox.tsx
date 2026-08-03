"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

async function copyImageToClipboard(previewUrl: string): Promise<void> {
  const response = await fetch(previewUrl);
  const blob = await response.blob();
  const type = blob.type || "image/png";

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
      return;
    } catch {
      // fall through — some browsers only accept image/png
    }
    if (type !== "image/png") {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not copy image.");
      ctx.drawImage(bitmap, 0, 0);
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("Could not encode PNG.")),
          "image/png",
        );
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      return;
    }
  }

  throw new Error("Clipboard image copy is not supported in this browser.");
}

export function AttachmentImageLightbox({
  open,
  name,
  previewUrl,
  onClose,
}: {
  open: boolean;
  name: string;
  previewUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setCopyError(null);
    }
  }, [open]);

  const handleCopy = useCallback(async () => {
    setCopyError(null);
    try {
      await copyImageToClipboard(previewUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      setCopyError(
        error instanceof Error ? error.message : "Could not copy image.",
      );
    }
  }, [previewUrl]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-[min(920px,94vw)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900",
            )}
            aria-label="Copy image"
            title="Copy image"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            aria-label="Close preview"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {}
        <img
          src={previewUrl}
          alt={name}
          className="max-h-[90vh] w-auto max-w-full object-contain"
        />

        {copyError ? (
          <p className="border-t border-zinc-100 px-4 py-2 text-center text-[12px] text-red-600">
            {copyError}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
