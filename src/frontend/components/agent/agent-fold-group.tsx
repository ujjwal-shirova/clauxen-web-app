"use client";

import type { ReactNode } from "react";
import type { AgentFoldSummary } from "@/frontend/lib/agent-fold-groups";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

/**
 * Cursor-style main activity fold — summary like "Explored 3 files, 5 searches".
 * Nested thinking/tool blocks live inside; narration stays outside.
 */
export function AgentFoldGroup({
  summary,
  isActive = false,
  defaultExpanded = false,
  children,
}: {
  summary: AgentFoldSummary;
  isActive?: boolean;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  return (
    <AgentTraceBlock
      title={
        isActive ? (
          <AgentShimmerText>{summary.label}</AgentShimmerText>
        ) : (
          summary.label
        )
      }
      isActive={isActive}
      defaultExpanded={defaultExpanded}
      showChevron
      className="agent-fold-group"
      headerClassName="agent-fold-group__header"
      contentClassName="agent-fold-group__body"
    >
      <div
        className="flex w-full min-w-0 flex-col gap-3"
        data-agent-fold-body="true"
      >
        {children}
      </div>
    </AgentTraceBlock>
  );
}
