"use client";

import type { ReactNode } from "react";
import type { AgentWorkGroup } from "@/lib/agent-work-groups";
import { AgentTraceBlock } from "./agent-trace";
import { AgentActivitySummaryLabel } from "./agent-activity-summary";

/**
 * Collapsible agent step in the flat activity stream.
 * The chevron appears only on hover/focus; children stay flush left.
 * Narration always renders outside this block.
 */
export function AgentWorkGroupView({
  group,
  trailing,
  children,
}: {
  group: AgentWorkGroup;
  /** Optional right-side chips (legacy — prefer per-tool trailing). */
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
          <AgentActivitySummaryLabel
            segments={group.segments}
            isActive={group.isActive}
            fallback={group.label}
          />
        }
        trailing={trailing}
        isActive={group.isActive}
        defaultExpanded={group.isActive}
        chevronMode="hover"
        className="agent-work-group"
        headerClassName="agent-work-group__header"
        contentClassName="agent-work-group__body"
        titleClassName="text-inherit"
      >
        <div
          className="relative flex w-full min-w-0 flex-col gap-1"
          data-agent-work-group-body="true"
        >
          {children}
        </div>
      </AgentTraceBlock>
    </div>
  );
}
