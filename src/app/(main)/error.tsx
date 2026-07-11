"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

export default function MainAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const autoTried = useRef(false);

  // One quiet auto-retry for transient chunk / challenge blips — like ChatGPT shell recovery.
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    const timer = window.setTimeout(() => reset(), 350);
    return () => window.clearTimeout(timer);
  }, [reset]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-white px-6 text-center text-zinc-900">
      <AlertTriangle className="h-12 w-12" strokeWidth={1.5} aria-hidden />
      <div>
        <h1 className="text-xl font-semibold">This page couldn&apos;t load</h1>
        <p className="mt-2 text-sm text-zinc-500">Reload to try again.</p>
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
          Reload
        </button>
      </div>
    </div>
  );
}
