"use client";

import type { ReactNode } from "react";
import { Check, Clock, Globe, Terminal } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

export type AgentTimelineIcon = "thinking" | "search" | "bash" | "tool" | "done";

const ICONS: Record<AgentTimelineIcon, typeof Clock> = {
  thinking: Clock,
  search: Globe,
  bash: Terminal,
  tool: Terminal,
  done: Check,
};

export function AgentTimeline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative ml-0.5 flex flex-col", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-3 left-[11px] top-3 w-px bg-zinc-200"
      />
      {children}
    </div>
  );
}

export function AgentTimelineStep({
  icon,
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
  const Icon = ICONS[icon];

  return (
    <div className={cn("relative pl-8", className)}>
      <div
        className={cn(
          "absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-md border bg-white",
          isActive
            ? "border-[#2c84db]/30 text-[#2c84db]"
            : "border-zinc-200 text-zinc-500",
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 pb-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div
            className={cn(
              "text-[14px] leading-5",
              isActive ? "text-zinc-700" : "text-zinc-500",
            )}
          >
            {title}
          </div>
          {trailing ? (
            <div className="shrink-0 text-[12px] text-zinc-400">{trailing}</div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function AgentTimelineDone({ label = "Done" }: { label?: string }) {
  return (
    <AgentTimelineStep icon="done" title={label} className="pb-1" />
  );
}
