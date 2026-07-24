"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AgentTraceBlock } from "./agent-trace";
import { useAgentTurnStreaming } from "./agent-turn-streaming";

/**
 * Compact tool action block. Collapsed by default. Optional leading chips
 * (search favicons) + chevron in the header. No status dots — shimmer alone
 * signals a live turn (tool running or assistant turn still streaming).
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
  const turnStreaming = useAgentTurnStreaming();
  const live = Boolean(isRunning) || turnStreaming;

  return (
    <AgentTraceBlock
      isActive={live}
      defaultExpanded={defaultExpanded}
      title={
        <span
          key={live ? `tool-run-${String(label)}` : `tool-done-${String(label)}`}
          className={cn(live && "shimmer-text")}
          data-shimmer-active={live || undefined}
        >
          {label}
        </span>
      }
      leading={leading}
      trailing={trailing}
      className={className}
    >
      {children}
    </AgentTraceBlock>
  );
}
