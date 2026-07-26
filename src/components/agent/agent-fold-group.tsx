"use client";

import type { ReactNode } from "react";
import type { AgentFoldSummary } from "@/lib/agent-fold-groups";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

/**
 * Activity fold — expanded while its own work is live (`isActive`).
 * Shimmer stops when this fold’s tools/thinking finish — not when the
 * whole assistant turn ends.
 */
export function AgentFoldGroup({
  summary,
  isActive = false,
  useChrome = true,
  children,
}: {
  summary: AgentFoldSummary;
  isActive?: boolean;
  useChrome?: boolean;
  children: ReactNode;
}) {
  return (
    <AgentTraceBlock
      title={
        isActive ? (
          <AgentShimmerText key={`fold-live-${summary.verb}`} active>
            {summary.label}
          </AgentShimmerText>
        ) : (
          summary.label
        )
      }
      isActive={isActive}
      defaultExpanded={useChrome ? isActive : true}
      showChevron={useChrome}
      hideHeader={!useChrome}
      className="agent-fold-group"
      headerClassName="agent-fold-group__header"
      contentClassName="agent-fold-group__body"
    >
      <div
        className="flex w-full min-w-0 flex-col gap-3"
        data-agent-fold-body="true"
        data-agent-fold={useChrome ? "chrome" : "bare"}
      >
        {children}
      </div>
    </AgentTraceBlock>
  );
}
