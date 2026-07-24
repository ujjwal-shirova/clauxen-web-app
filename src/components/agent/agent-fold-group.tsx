"use client";

import type { ReactNode } from "react";
import type { AgentFoldSummary } from "@/lib/agent-fold-groups";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";
import { useAgentTurnStreaming } from "./agent-turn-streaming";

/**
 * Activity fold — expanded while live (`isActive`), auto-collapses when done.
 * Nested web-search stays collapsed via its own defaultExpanded={false}.
 * Shimmer stays on until the whole assistant turn finishes.
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
  const turnStreaming = useAgentTurnStreaming();
  const live = isActive || turnStreaming;

  return (
    <AgentTraceBlock
      title={
        live ? (
          <AgentShimmerText key={`fold-live-${summary.verb}`} active>
            {summary.label}
          </AgentShimmerText>
        ) : (
          summary.label
        )
      }
      isActive={live}
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
