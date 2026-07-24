"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AgentTraceBlock } from "./agent-trace";

/**
 * Compact tool action block. Collapsed by default. Optional leading chips
 * (search favicons) + chevron in the header.
 */
export function AgentToolCard({
  label,
  trailing,
  leading,
  isRunning,
  children,
  defaultExpanded = false,
  className,
}: {
  label: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  isRunning?: boolean;
  children?: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}) {
  return (
    <AgentTraceBlock
      isActive={!!isRunning}
      defaultExpanded={defaultExpanded}
      title={
        <span
          key={isRunning ? `tool-run-${String(label)}` : `tool-done-${String(label)}`}
          className={cn(isRunning && "shimmer-text")}
          data-shimmer-active={isRunning || undefined}
        >
          {label}
        </span>
      }
      leading={leading}
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
