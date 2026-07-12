"use client";

import { useEffect } from "react";

const RECOVER_KEY = "clx_chunk_recover_at";
const RECOVER_COOLDOWN_MS = 15_000;

function isChunkFailure(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : String(reason ?? "");
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module")
  );
}

function softReloadOnce() {
  if (typeof window === "undefined") return;
  try {
    const last = Number(sessionStorage.getItem(RECOVER_KEY) || "0");
    if (Date.now() - last < RECOVER_COOLDOWN_MS) return;
    sessionStorage.setItem(RECOVER_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
  // Same-document reload keeps path/hash; works after Vercel challenge settles.
  window.location.reload();
}

/**
 * When Attack Challenge briefly blocks a JS chunk, Next throws ChunkLoadError.
 * Recover with one silent reload instead of blanking the app into error.tsx.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkFailure(event.error ?? event.message)) {
        event.preventDefault();
        softReloadOnce();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkFailure(event.reason)) {
        event.preventDefault();
        softReloadOnce();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
