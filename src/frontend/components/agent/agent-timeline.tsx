"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/**
 * Flat work-log chrome (Cursor-style), replacing the old vertical rail + icon boxes.
 * Tool/thinking blocks still compose through AgentTimelineStep so streaming
 * and rich tool UIs stay intact — only the presentation shell changed.
 */

export type AgentTimelineIcon =
  | "thinking"
  | "search"
  | "bash"
  | "file"
  | "tool"
  | "done";

export function AgentTimeline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2.5 border-l border-zinc-200/80 pl-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AgentTimelineStep({
  icon: _icon,
  title,
  trailing,
  isActive = false,
  children,
  className,
}: {
  icon: AgentTimelineIcon;
  title: ReactNode;
  trailing?: ReactNode;
  isActive?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "min-w-0 flex-1 text-[14px] leading-[1.45]",
            isActive ? "text-zinc-800" : "text-zinc-500",
          )}
        >
          {title}
        </div>
        {trailing ? (
          <div className="shrink-0 pt-0.5 text-[12px] text-zinc-400">
            {trailing}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-1.5 min-w-0">{children}</div> : null}
    </div>
  );
}

export function AgentTimelineDone({ label = "Done" }: { label?: string }) {
  return (
    <AgentTimelineStep
      icon="done"
      title={
        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-600">
          <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {label}
        </span>
      }
      className="pb-0.5"
    />
  );
}
