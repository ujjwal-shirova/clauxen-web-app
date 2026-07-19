"use client";

import type { ReactNode } from "react";
import type { AgentFoldSummary } from "@/frontend/lib/agent-fold-groups";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

/**
 * Cursor-style activity fold. When `useChrome` is false (lone thought/tool),
 * the outer Explored/Used header is omitted and the body stays open — same
 * component shell so upgrading to chrome mid-stream does not remount children.
 */
export function AgentFoldGroup({
  summary,
  isActive = false,
  useChrome = true,
  defaultExpanded = false,
  children,
}: {
  summary: AgentFoldSummary;
  isActive?: boolean;
  useChrome?: boolean;
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
      defaultExpanded={useChrome ? defaultExpanded : true}
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
