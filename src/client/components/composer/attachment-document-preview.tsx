"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, X } from "lucide-react";
import {
  isPdfDocument,
  isTextDocument,
} from "@/lib/composer-attachments";

export function AttachmentDocumentPreview({
  open,
  name,
  mimeType,
  previewUrl,
  textPreview,
  onClose,
}: {
  open: boolean;
  name: string;
  mimeType: string;
  previewUrl?: string;
  textPreview?: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [bodyText, setBodyText] = useState(textPreview ?? "");
  const [loading, setLoading] = useState(false);
  const isPdf = isPdfDocument({ name, mimeType });
  const isText = isTextDocument({ name, mimeType });

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
    if (!open) return;
    setBodyText(textPreview ?? "");
    if (textPreview || !isText || !previewUrl) return;

    let cancelled = false;
    setLoading(true);
    void fetch(previewUrl)
      .then((response) => response.text())
      .then((text) => {
        if (!cancelled) setBodyText(text);
      })
      .catch(() => {
        if (!cancelled) setBodyText("Could not load document preview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, textPreview, isText, previewUrl]);

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
        className="relative flex h-[min(780px,90vh)] w-[min(720px,94vw)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
            <h2 className="truncate text-[14px] font-medium text-zinc-900">
              {name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            aria-label="Close preview"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-zinc-50/60 p-5">
          {isText ? (
            loading ? (
              <p className="text-[13px] text-zinc-400">Loading preview…</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-5 text-zinc-800">
                {bodyText || "Empty document."}
              </pre>
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white">
                <FileText className="h-6 w-6 text-zinc-500" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-zinc-800">{name}</p>
                <p className="mt-1 text-[12px] text-zinc-500">
                  {isPdf
                    ? "PDF preview opens via download for now."
                    : "Preview is available for text documents."}
                </p>
              </div>
              {previewUrl ? (
                <a
                  href={previewUrl}
                  download={name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
