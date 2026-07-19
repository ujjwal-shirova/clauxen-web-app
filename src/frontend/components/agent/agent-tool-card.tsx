"use client";

import type { ReactNode } from "react";
import { cn } from "@/frontend/lib/utils";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

/**
 * Compact tool-execution card. Wraps the per-tool rich surfaces (search,
 * bash, weather, etc.) with a consistent minimal header: a small monospace
 * label, a live status pill, and an expandable body for the tool's native
 * result surface.
 *
 * While running: shimmering label + spinning indicator.
 * When done: a quiet result count or checkmark, body collapsed by default.
 */
export function AgentToolCard({
  variant = "tool",
  label,
  isRunning,
  statusPill,
  children,
  defaultExpanded,
  forceExpand,
}: {
  variant?: "tool" | "search" | "bash" | "file" | "done";
  label: ReactNode;
  isRunning?: boolean;
  /** Custom trailing pill content (e.g. "3 results", a spinner, "done"). */
  statusPill?: ReactNode;
  children?: ReactNode;
  defaultExpanded?: boolean;
  /** Force the body to render expanded (e.g. rich result cards the user
   * should always see, like weather or image search). */
  forceExpand?: boolean;
}) {
  return (
    <AgentTraceBlock
      variant={variant}
      isActive={!!isRunning}
      defaultExpanded={forceExpand ? true : defaultExpanded}
      title={
        <AgentShimmerText className={cn(isRunning && "block max-w-full truncate")}>
          {label}
        </AgentShimmerText>
      }
      trailing={
        statusPill ?? (isRunning ? <ToolRunningDot /> : null)
      }
    >
      {children}
    </AgentTraceBlock>
  );
}

export function ToolRunningDot() {
  return (
    <span
      className="agent-trace__running-dot inline-block h-1.5 w-1.5 rounded-full bg-zinc-500"
      aria-hidden
    />
  );
}
