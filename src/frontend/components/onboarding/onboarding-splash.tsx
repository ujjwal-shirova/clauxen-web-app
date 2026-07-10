"use client";

import { cn } from "@/frontend/lib/utils";
import { ClauxenWordmark } from "./clauxen-wordmark";

/** Full-screen splash while onboarding persists / navigates. */
export function OnboardingSplash({
  message = "Setting things up…",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-[var(--app-shell-bg,#f9f9f9)]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <ClauxenWordmark />
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-zinc-200 border-t-zinc-900"
          aria-hidden
        />
        <p className="text-sm font-medium text-zinc-500">{message}</p>
      </div>
    </div>
  );
}
