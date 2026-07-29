"use client";

import type { ReactNode } from "react";
import type { AgentWorkGroup } from "@/lib/agent-work-groups";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

/**
 * One step of the agent's work. The header is derived from the narration
 * that announced the step ("Checking the latest pricing…") and shimmers
 * while any member runs; the group auto-collapses to the past-tense header
 * ("Checked the latest pricing") once everything inside completes.
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
        className="flex w-full min-w-0 flex-col gap-3 border-l border-zinc-200/80 pl-3.5 ml-[3px]"
        data-agent-work-group-body="true"
        data-has-narration={hasNarration || undefined}
      >
        {children}
      </div>
    </AgentTraceBlock>
  );
}
