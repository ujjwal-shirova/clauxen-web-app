"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

type SavedToastState = {
  id: number;
  open: boolean;
};

let toastId = 0;
let listeners = new Set<(state: SavedToastState | null) => void>();
let current: SavedToastState | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: SavedToastState | null) {
  current = next;
  for (const listener of listeners) listener(next);
}

/** Compact top-right "Saved" pill — matches the settings save affordance. */
export function showSavedNotification() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  const id = ++toastId;
  emit({ id, open: true });
  hideTimer = setTimeout(() => {
    if (current?.id === id) emit(null);
  }, 2200);
}

function dismissSavedNotification() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  emit(null);
}

export function SavedNotificationHost() {
  const [state, setState] = useState<SavedToastState | null>(current);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  if (!mounted || !state?.open) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed right-4 top-4 z-[200] flex items-center gap-2.5 rounded-xl border border-zinc-200/90 bg-white px-3.5 py-2.5 text-zinc-900 shadow-[0_8px_28px_rgba(24,24,27,0.12)] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <Info className="h-4 w-4 shrink-0 text-zinc-800" aria-hidden />
      <span className="text-[13.5px] font-medium leading-none">Saved</span>
      <button
        type="button"
        onClick={dismissSavedNotification}
        className="ml-1 flex h-5 w-5 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>,
    document.body,
  );
}
