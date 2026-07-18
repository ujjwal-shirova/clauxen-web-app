/**
 * Minimal chronological activity trace.
 *
 * Design rules:
 * A quiet hairline and state dots establish order without imitating another
 * product's transcript chrome. Active rows expand and follow their own output.
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
        "agent-trace relative flex flex-col gap-2 before:pointer-events-none before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-zinc-200/80",
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
  icon = "tool",
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
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <span
        className={cn(
          "min-w-0 truncate text-[13px] font-medium leading-5 tracking-[-0.005em]",
          isActive ? "text-zinc-800" : "text-zinc-600",
        )}
      >
        {title}
      </span>
      {canCollapse ? (
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-zinc-400 transition-transform duration-200",
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
      className={cn("relative grid min-w-0 grid-cols-[12px_minmax(0,1fr)] gap-2.5 animate-in fade-in duration-200 ease-out", className)}
      data-agent-activity="row"
      data-agent-activity-kind={icon}
      data-active={isActive || undefined}
    >
      <span
        className={cn(
          "relative z-[1] mt-[6px] block h-[11px] w-[11px] rounded-full border bg-white",
          isActive
            ? "border-zinc-500 shadow-[0_0_0_3px_rgba(161,161,170,0.15)]"
            : "border-zinc-300",
        )}
        aria-hidden
      >
        {isActive ? (
          <span className="absolute inset-[3px] rounded-full bg-zinc-600" />
        ) : null}
      </span>

      <div className="min-w-0">
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
    </div>
  );
}

/** @deprecated Use AgentActivityRow */
export const AgentTimelineStep = AgentActivityRow;

