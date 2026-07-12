"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

function isTransientChunkError(error: Error & { name?: string }) {
  const name = error?.name ?? "";
  const message = error?.message ?? "";
  return (
    name === "ChunkLoadError" ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed")
  );
}

export default function MainAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const autoTried = useRef(false);

  // Soft recovery for transient chunk / challenge blips — do not hard-reload
  // the whole tab (that felt like a 10s "suddenly couldn't load" failure).
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    if (!isTransientChunkError(error)) return;
    const timer = window.setTimeout(() => reset(), 500);
    return () => window.clearTimeout(timer);
  }, [error, reset]);

  useEffect(() => {
    console.error("[main] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-white px-6 text-center text-zinc-900">
      <AlertTriangle className="h-12 w-12" strokeWidth={1.5} aria-hidden />
      <div>
        <h1 className="text-xl font-semibold">This page couldn&apos;t load</h1>
        <p className="mt-2 text-sm text-zinc-500">
          A temporary error interrupted this view. You can try again without
          losing your place.
        </p>
        {process.env.NODE_ENV === "development" && error?.message ? (
          <p className="mt-3 max-w-lg text-left font-mono text-xs text-rose-600">
            {error.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.assign("/");
          }}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          New chat
        </button>
      </div>
    </div>
  );
}
