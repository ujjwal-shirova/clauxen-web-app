"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/**
 * Clauxen agent action stack — chronological interleaved thinking, narration,
 * and tool results. No vertical timeline rail. Sequence by spacing alone.
 * Blocks are collapsed by default; the user expands them.
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
 * Collapsible action block. Collapsed by default.
 * Optional leading chips (e.g. search favicons) + chevron in the header.
 */
export function AgentTraceBlock({
  title,
  trailing,
  leading,
  showChevron = true,
  isActive = false,
  defaultExpanded = false,
  children,
  className,
  contentClassName,
  headerClassName,
}: {
  title: ReactNode;
  trailing?: ReactNode;
  /** Leading adornments in the header (e.g. first 3 source favicons). */
  leading?: ReactNode;
  showChevron?: boolean;
  isActive?: boolean;
  defaultExpanded?: boolean;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
}) {
  const hasBody = children != null && children !== false;
  const canCollapse = hasBody;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const userToggledRef = useRef(false);

  useEffect(() => {
    if (!canCollapse) return;
    // Stay collapsed by default. Only follow defaultExpanded when the user
    // has not manually toggled — do not auto-expand just because a tool is
    // running (user expands intentionally).
    if (!userToggledRef.current) {
      setExpanded(defaultExpanded);
    }
  }, [isActive, canCollapse, defaultExpanded]);

  const toggle = () => {
    if (!canCollapse) return;
    userToggledRef.current = true;
    setExpanded((value) => !value);
  };

  const headerInner = (
    <>
      {leading ? (
        <span className="agent-trace__leading inline-flex shrink-0 items-center">
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-[13px] font-[430] leading-5 tracking-[-0.01em] text-zinc-400">
        {title}
      </span>
      {trailing ? (
        <span className="shrink-0 text-[12px] tabular-nums text-zinc-400">
          {trailing}
        </span>
      ) : null}
      {showChevron && canCollapse ? (
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-200",
            expanded && "rotate-90",
          )}
          aria-hidden
        />
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "agent-trace__block min-w-0 animate-in fade-in duration-200 ease-out",
        className,
      )}
      data-agent-trace-block="true"
      data-active={isActive || undefined}
      data-expanded={expanded || undefined}
    >
      {canCollapse ? (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "agent-trace__header no-hover no-hover-overlay flex w-full max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0",
            headerClassName,
          )}
          aria-expanded={expanded}
        >
          {headerInner}
        </button>
      ) : (
        <div
          className={cn(
            "flex w-full max-w-full items-center gap-1.5",
            headerClassName,
          )}
        >
          {headerInner}
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
