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
 * Header: leading chips · label · chevron (beside the label, not flush right).
 */
export function AgentTraceBlock({
  title,
  trailing,
  leading,
  showChevron = true,
  hideHeader = false,
  isActive = false,
  defaultExpanded = false,
  children,
  className,
  contentClassName,
  headerClassName,
}: {
  title: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  showChevron?: boolean;
  hideHeader?: boolean;
  isActive?: boolean;
  defaultExpanded?: boolean;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
}) {
  const hasBody = children != null && children !== false;
  const canCollapse = hasBody && !hideHeader;
  const [expanded, setExpanded] = useState(hideHeader ? true : defaultExpanded);
  const userToggledRef = useRef(false);

  useEffect(() => {
    if (hideHeader) {
      setExpanded(true);
      return;
    }
    if (!canCollapse) return;
    if (!userToggledRef.current) {
      setExpanded(defaultExpanded);
    }
  }, [canCollapse, defaultExpanded, hideHeader]);

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
      <span className="inline-flex min-w-0 max-w-full items-center gap-1">
        <span className="min-w-0 truncate text-left text-[13px] font-[430] leading-5 tracking-[-0.01em] text-zinc-400">
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
      </span>
    </>
  );

  return (
    <div
      className={cn("agent-trace__block min-w-0", className)}
      data-agent-trace-block="true"
      data-active={isActive || undefined}
      data-expanded={expanded || undefined}
      data-header-hidden={hideHeader || undefined}
    >
      {!hideHeader ? (
        canCollapse ? (
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
        )
      ) : null}

      {hasBody ? (
        <div
          className={cn(
            "grid",
            !isActive &&
              !hideHeader &&
              "transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
            expanded || hideHeader ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!(expanded || hideHeader)}
        >
          <div
            className={cn(
              "overflow-hidden",
              !isActive && !hideHeader && "transition-opacity duration-150",
              expanded || hideHeader ? "opacity-100" : "opacity-0",
              contentClassName,
            )}
          >
            <div className={cn(!hideHeader && "pt-2")}>{children}</div>
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
