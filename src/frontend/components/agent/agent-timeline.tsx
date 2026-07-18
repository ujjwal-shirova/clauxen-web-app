/**
 * Agentic activity chrome (Clauxen Code–inspired).
 *
 * Design rules:
 * - No left-rail vertical timeline
 * - Chevron sits immediately after the label (never far-right)
 * - Trailing meta (favicons, counts) follows the chevron
 * - Expanded bodies are softly indented under the label
 * - One activity stream per assistant turn (not stacked Brewed/Churned chips)
 */

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

export type AgentActivityIcon =
  | "thinking"
  | "search"
  | "bash"
  | "file"
  | "tool"
  | "done";

export function AgentActivityList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1",
        className,
      )}
      data-agent-activity="list"
    >
      {children}
    </div>
  );
}

/** @deprecated Use AgentActivityList — kept as alias for older imports. */
export const AgentTimeline = AgentActivityList;

export function AgentActivityRow({
  title,
  trailing,
  isActive = false,
  collapsible = true,
  defaultExpanded,
  children,
  className,
}: {
  icon?: AgentActivityIcon;
  title: ReactNode;
  trailing?: ReactNode;
  isActive?: boolean;
  collapsible?: boolean;
  /** Override default expand behavior (active → open, idle → closed). */
  defaultExpanded?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const hasBody = children != null && children !== false;
  const canCollapse = collapsible && hasBody;
  const [expanded, setExpanded] = useState(
    defaultExpanded ?? isActive,
  );
  const userToggledRef = useRef(false);

  useEffect(() => {
    if (!canCollapse) return;
    if (isActive) {
      userToggledRef.current = false;
      setExpanded(true);
      return;
    }
    if (!userToggledRef.current) {
      setExpanded(defaultExpanded ?? false);
    }
  }, [isActive, canCollapse, defaultExpanded]);

  const toggle = () => {
    if (!canCollapse) return;
    userToggledRef.current = true;
    setExpanded((value) => !value);
  };

  const header = (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <span
        className={cn(
          "min-w-0 truncate text-[13.5px] leading-5",
          isActive ? "text-zinc-700" : "text-zinc-500",
        )}
      >
        {title}
      </span>
      {canCollapse ? (
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200",
            expanded && "rotate-90",
          )}
          aria-hidden
        />
      ) : null}
      {trailing ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 pl-0.5 text-[12px] text-zinc-400">
          {trailing}
        </span>
      ) : null}
    </span>
  );

  return (
    <div
      className={cn(
        "min-w-0 animate-in fade-in duration-200 ease-out",
        className,
      )}
      data-agent-activity="row"
      data-active={isActive || undefined}
    >
      {canCollapse ? (
        <button
          type="button"
          onClick={toggle}
          className="no-hover no-hover-overlay inline-flex max-w-full items-center border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0"
          aria-expanded={expanded}
        >
          {header}
        </button>
      ) : (
        <div className="inline-flex max-w-full items-center">{header}</div>
      )}

      {hasBody ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!expanded}
        >
          <div
            className={cn(
              "overflow-hidden pt-1.5 transition-opacity duration-200",
              expanded ? "opacity-100" : "opacity-0",
            )}
          >
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use AgentActivityRow */
export const AgentTimelineStep = AgentActivityRow;

export function AgentTimelineDone({ label = "Done" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-400">
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
