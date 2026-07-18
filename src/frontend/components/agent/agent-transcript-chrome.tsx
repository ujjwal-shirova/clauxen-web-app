"use client";

import { Check } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/** Compact tool-phase label above a tool card (e.g. "Searched the web"). */
export function AgentActionLabel({
  children,
  active = false,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[13px] font-medium leading-5 text-zinc-400",
        active && "shimmer-text text-zinc-500",
        className,
      )}
      data-agent-action-label
    >
      {children}
    </div>
  );
}

/** Checkmark + Done — end of a tool/thinking phase in the transcript. */
export function AgentTranscriptDone({
  label = "Done",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium leading-5 text-zinc-400",
        className,
      )}
      data-agent-status="done"
    >
      <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
