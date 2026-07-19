"use client";

import type { ReactNode } from "react";
import { cn } from "@/frontend/lib/utils";
import { AgentTraceBlock } from "./agent-trace";

/**
 * Compact tool action block. A muted header line (query / label + status)
 * sits above an optional expandable result body — no timeline rail, no
 * coding-agent diff chrome. Search results and other surfaces render
 * inline under the header.
 */
export function AgentToolCard({
  label,
  trailing,
  isRunning,
  children,
  defaultExpanded,
  forceExpand,
  className,
}: {
  label: ReactNode;
  trailing?: ReactNode;
  isRunning?: boolean;
  children?: ReactNode;
  defaultExpanded?: boolean;
  forceExpand?: boolean;
  className?: string;
}) {
  return (
    <AgentTraceBlock
      isActive={!!isRunning}
      defaultExpanded={forceExpand ? true : defaultExpanded}
      title={
        <span className={cn(isRunning && "shimmer-text")}>{label}</span>
      }
      trailing={
        trailing ??
        (isRunning ? (
          <span
            className="agent-trace__running-dot inline-block h-1.5 w-1.5 rounded-full bg-zinc-400"
            aria-hidden
          />
        ) : null)
      }
      className={className}
    >
      {children}
    </AgentTraceBlock>
  );
}

export function ToolRunningDot() {
  return (
    <span
      className="agent-trace__running-dot inline-block h-1.5 w-1.5 rounded-full bg-zinc-400"
      aria-hidden
    />
  );
}
