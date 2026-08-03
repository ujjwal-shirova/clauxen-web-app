"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AgentTraceBlock } from "./agent-trace";

/**
 * Compact tool action block. Collapsed by default. Optional leading chips
 * (search favicons) + chevron in the header. Shimmer only while this tool
 * is running — stops as soon as the tool completes.
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
  const live = Boolean(isRunning);

  return (
    <AgentTraceBlock
      isActive={live}
      defaultExpanded={defaultExpanded}
      chevronMode="hover"
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
      titleClassName="text-inherit"
    >
      {children}
    </AgentTraceBlock>
  );
}
