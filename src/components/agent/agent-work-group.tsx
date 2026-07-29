"use client";

import type { ReactNode } from "react";
import type { AgentWorkGroup } from "@/lib/agent-work-groups";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

/**
 * Collapsible agent step with a left timeline rail. Header is derived from
 * narration (gerund while live → past tense when done) and auto-collapses.
 */
export function AgentWorkGroupView({
  group,
  children,
}: {
  group: AgentWorkGroup;
  children: ReactNode;
}) {
  const hasNarration = Boolean(group.narration?.content.trim());

  return (
    <AgentTraceBlock
      title={
        group.isActive ? (
          <AgentShimmerText key={`wg-live-${group.id}`} active>
            {group.label}
          </AgentShimmerText>
        ) : (
          group.label
        )
      }
      isActive={group.isActive}
      defaultExpanded={group.isActive}
      showChevron
      className="agent-work-group"
      headerClassName="agent-work-group__header"
      contentClassName="agent-work-group__body"
    >
      <div
        className="relative flex w-full min-w-0 flex-col gap-2.5 border-l border-zinc-200/90 pl-3.5 ml-[2px]"
        data-agent-work-group-body="true"
        data-has-narration={hasNarration || undefined}
      >
        {children}
      </div>
    </AgentTraceBlock>
  );
}
