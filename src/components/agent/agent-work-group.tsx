"use client";

import type { ReactNode } from "react";
import type { AgentWorkGroup } from "@/lib/agent-work-groups";
import { AgentTraceBlock, AgentShimmerText } from "./agent-trace";

/**
 * Collapsible agent step with a left timeline rail. Header is derived from
 * preceding narration (gerund while live → past tense when done). Narration
 * itself always renders outside this block.
 */
export function AgentWorkGroupView({
  group,
  trailing,
  children,
}: {
  group: AgentWorkGroup;
  /** Optional right-side chips (e.g. web-search favicons). */
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="agent-work-group-enter"
      data-agent-work-group="true"
      data-active={group.isActive || undefined}
    >
      <AgentTraceBlock
        title={
          group.isActive ? (
            <AgentShimmerText key={`wg-live-${group.id}`} active>
              {group.label}
            </AgentShimmerText>
          ) : (
            // Past-tense label never shimmers — done steps must not keep the
            // sweeping highlight when the agent starts the next step.
            <span key={`wg-done-${group.id}`}>{group.label}</span>
          )
        }
        trailing={trailing}
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
        >
          {children}
        </div>
      </AgentTraceBlock>
    </div>
  );
}
