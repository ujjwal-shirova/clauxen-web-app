"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/frontend/lib/utils";

/**
 * Clauxen agent action stack — chronological interleaved thinking, narration,
 * and tool results. No vertical timeline rail, no dots, no left accent line.
 * Sequence is established by vertical spacing alone.
 */
export function AgentTrace({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("agent-trace flex w-full min-w-0 flex-col gap-4", className)}
      data-agent-trace="true"
    >
      {children}
    </div>
  );
}

/**
 * Collapsible action block without timeline chrome.
 * Header is a quiet muted label; body expands/collapses smoothly.
 */
export function AgentTraceBlock({
  title,
  trailing,
  isActive = false,
  defaultExpanded,
  children,
  className,
  contentClassName,
  headerClassName,
}: {
  title: ReactNode;
  trailing?: ReactNode;
  isActive?: boolean;
  defaultExpanded?: boolean;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
}) {
  const hasBody = children != null && children !== false;
  const canCollapse = hasBody;
  const [expanded, setExpanded] = useState(defaultExpanded ?? isActive);
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

  return (
    <div
      className={cn(
        "agent-trace__block min-w-0 animate-in fade-in duration-200 ease-out",
        className,
      )}
      data-agent-trace-block="true"
      data-active={isActive || undefined}
    >
      {canCollapse ? (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "agent-trace__header no-hover no-hover-overlay flex w-full max-w-full items-center gap-2 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0",
            headerClassName,
          )}
          aria-expanded={expanded}
        >
          <span className="min-w-0 flex-1 truncate text-[13px] font-[430] leading-5 tracking-[-0.01em] text-zinc-400">
            {title}
          </span>
          {trailing ? (
            <span className="shrink-0 text-[12px] tabular-nums text-zinc-400">
              {trailing}
            </span>
          ) : null}
        </button>
      ) : (
        <div
          className={cn(
            "flex w-full max-w-full items-center gap-2",
            headerClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-[13px] font-[430] leading-5 tracking-[-0.01em] text-zinc-400">
            {title}
          </span>
          {trailing ? (
            <span className="shrink-0 text-[12px] tabular-nums text-zinc-400">
              {trailing}
            </span>
          ) : null}
        </div>
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
              "overflow-hidden transition-opacity duration-200",
              expanded ? "opacity-100" : "opacity-0",
              contentClassName,
            )}
          >
            <div className="pt-2">{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AgentShimmerText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("shimmer-text", className)}>{children}</span>;
}
