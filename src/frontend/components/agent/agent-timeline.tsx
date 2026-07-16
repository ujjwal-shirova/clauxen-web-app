"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/**
 * Flat work-log chrome — Cursor / Clauxen Code style:
 * each step has a chevron header; details default collapsed when idle.
 */

export type AgentTimelineIcon =
  | "thinking"
  | "search"
  | "bash"
  | "file"
  | "tool"
  | "done";

export function AgentTimeline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 border-l border-zinc-200/80 pl-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AgentTimelineStep({
  icon: _icon,
  title,
  trailing,
  isActive = false,
  /** When true, title row shows a chevron and children collapse (default closed unless active). */
  collapsible = true,
  children,
  className,
}: {
  icon: AgentTimelineIcon;
  title: ReactNode;
  trailing?: ReactNode;
  isActive?: boolean;
  collapsible?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const hasBody = children != null && children !== false;
  const canCollapse = collapsible && hasBody;
  const [expanded, setExpanded] = useState(isActive);
  const userToggledRef = useRef(false);

  useEffect(() => {
    if (!canCollapse) return;
    if (isActive) {
      userToggledRef.current = false;
      setExpanded(true);
      return;
    }
    // Idle / complete → collapse by default (Clauxen Code thinking pattern).
    if (!userToggledRef.current) {
      setExpanded(false);
    }
  }, [isActive, canCollapse]);

  const toggle = () => {
    if (!canCollapse) return;
    userToggledRef.current = true;
    setExpanded((value) => !value);
  };

  const titleRow = (
    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
      <div
        className={cn(
          "min-w-0 flex-1 text-[14px] leading-[1.45]",
          // Don't set solid text color while active — child `.shimmer-text`
          // needs `color: transparent` + background-clip to animate.
          !isActive && "text-zinc-500",
        )}
      >
        {title}
      </div>
      {trailing ? (
        <div className="shrink-0 pt-0.5 text-[12px] text-zinc-400">
          {trailing}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out",
        className,
      )}
    >
      {canCollapse ? (
        <button
          type="button"
          onClick={toggle}
          className="no-hover no-hover-overlay flex w-full max-w-full items-start gap-1.5 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0"
          aria-expanded={expanded}
        >
          {titleRow}
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200",
              expanded ? "rotate-180" : "-rotate-90",
            )}
            aria-hidden
          />
        </button>
      ) : (
        <div className="flex w-full max-w-full items-start gap-1.5">
          {titleRow}
        </div>
      )}

      {canCollapse ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!expanded}
        >
          <div
            className={cn(
              "overflow-hidden transition-opacity duration-200",
              expanded ? "mt-1.5 opacity-100 delay-75" : "opacity-0",
            )}
          >
            {children}
          </div>
        </div>
      ) : hasBody ? (
        <div className="mt-1.5 min-w-0">{children}</div>
      ) : null}
    </div>
  );
}

export function AgentTimelineDone({ label = "Done" }: { label?: string }) {
  return (
    <AgentTimelineStep
      icon="done"
      collapsible={false}
      title={
        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-600">
          <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {label}
        </span>
      }
      className="pb-0.5"
    />
  );
}
