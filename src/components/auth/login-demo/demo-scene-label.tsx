"use client";

import { cn } from "@/lib/utils";

/**
 * Demo-only title card — same chrome as the chat window, used between
 * product-demo chapters (agentic work → files).
 */
export function DemoSceneLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      data-demo-scene-label
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-white",
        className,
      )}
      aria-hidden
    >
      <div className="flex shrink-0 items-center gap-1.5 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-[#FF5F57]/90" />
        <span className="h-2 w-2 rounded-full bg-[#FEBC2E]/90" />
        <span className="h-2 w-2 rounded-full bg-[#28C840]/90" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 pb-8">
        <p className="max-w-[19rem] text-center font-serif text-[1.35rem] font-normal italic leading-snug tracking-[-0.01em] text-zinc-800 sm:text-[1.5rem]">
          {label}
        </p>
      </div>
    </div>
  );
}
