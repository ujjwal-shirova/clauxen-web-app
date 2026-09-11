"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function AttachmentVideoLightbox({
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

  if (!open || !mounted || !previewUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-[min(920px,94vw)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition-colors hover:bg-black/75"
          aria-label="Close preview"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <video
          src={previewUrl}
          controls
          playsInline
          className="max-h-[90vh] w-auto max-w-full"
        >
          {name}
        </video>
      </div>
    </div>,
    document.body,
  );
}
