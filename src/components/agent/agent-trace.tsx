"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { preserveScrollAnchorOnToggle } from "@/lib/chat-scroll-anchor";

/**
 * Clauxen agent action stack — chronological interleaved thinking, narration,
 * and tool results. No vertical timeline rail. Sequence by spacing alone.
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
 * Collapsible action block.
 * Header: leading chips · label · chevron (beside the label).
 * Instant expand/collapse (no height transition) so chat scroll stays stable.
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
  const headerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (hideHeader) {
      setExpanded(true);
      return;
    }
    if (!canCollapse) return;
    if (userToggledRef.current) return;
    setExpanded(defaultExpanded);
  }, [canCollapse, defaultExpanded, hideHeader]);

  const toggle = () => {
    if (!canCollapse) return;
    userToggledRef.current = true;
    preserveScrollAnchorOnToggle(headerRef.current, () => {
      setExpanded((value) => !value);
    });
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

  const showBody = hasBody && (expanded || hideHeader);

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
            ref={headerRef}
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

      {showBody ? (
        <div className={cn(contentClassName)}>
          <div className={cn(!hideHeader && "pt-2")}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}

export function AgentShimmerText({
  children,
  className,
  active = true,
}: {
  children: ReactNode;
  className?: string;
  /** When false, render plain text immediately (no residual animation). */
  active?: boolean;
}) {
  if (!active) {
    return <span className={className}>{children}</span>;
  }
  return (
    <span className={cn("shimmer-text", className)} data-shimmer-active="true">
      {children}
    </span>
  );
}
