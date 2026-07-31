"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { preserveScrollAnchorOnToggle } from "@/lib/chat-scroll-anchor";

/**
 * Clauxen agent action stack — chronological interleaved thinking, narration,
 * and tool results. Sequence by spacing; rows stay flush-left (no tree indent).
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
      className={cn(
        "agent-trace flex w-full min-w-0 flex-col gap-1.5",
        className,
      )}
      data-agent-trace="true"
    >
      {children}
    </div>
  );
}

export type AgentTraceChevronMode =
  | "never"
  | "hover"
  | "hover-collapsed"
  | "always";

/**
 * Collapsible action block.
 * Header chrome: title · trailing · optional chevron.
 * Expand grows downward via scroll-anchor lock.
 */
export function AgentTraceBlock({
  title,
  trailing,
  leading,
  showChevron = true,
  chevronMode,
  hideHeader = false,
  isActive = false,
  defaultExpanded = false,
  children,
  className,
  contentClassName,
  headerClassName,
  titleClassName,
}: {
  title: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  /** @deprecated Prefer chevronMode. */
  showChevron?: boolean;
  chevronMode?: AgentTraceChevronMode;
  hideHeader?: boolean;
  isActive?: boolean;
  defaultExpanded?: boolean;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
}) {
  const hasBody = children != null && children !== false;
  const canCollapse = hasBody && !hideHeader;
  const mode: AgentTraceChevronMode =
    chevronMode ?? (showChevron ? "hover" : "never");
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

  const showChevronIcon = mode !== "never" && canCollapse;
  const chevronVisibleClass =
    mode === "always"
      ? "opacity-100"
      : mode === "hover-collapsed"
        ? cn(
            "opacity-0 group-hover/trace-header:opacity-100 group-focus-visible/trace-header:opacity-100",
            expanded && "opacity-100",
          )
        : // hover
          "opacity-0 group-hover/trace-header:opacity-100 group-focus-visible/trace-header:opacity-100";

  const headerInner = (
    <>
      {leading ? (
        <span className="agent-trace__leading inline-flex shrink-0 items-center">
          {leading}
        </span>
      ) : null}
      <span
        className={cn(
          "agent-trace__title min-w-0 max-w-[min(100%,42rem)] truncate text-left text-[13px] font-[430] leading-5 tracking-[-0.01em]",
          titleClassName ?? "text-zinc-500",
        )}
      >
        {title}
      </span>
      {trailing ? (
        <span className="agent-trace__trailing inline-flex shrink-0 items-center gap-1.5">
          {trailing}
        </span>
      ) : null}
      {showChevronIcon ? (
        <ChevronRight
          className={cn(
            "agent-trace__chevron h-3.5 w-3.5 shrink-0 text-zinc-400 transition-[opacity,transform] duration-150 ease-out",
            chevronVisibleClass,
            expanded && "rotate-90",
          )}
          aria-hidden
        />
      ) : null}
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
              "agent-trace__header group/trace-header no-hover no-hover-overlay inline-flex max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0",
              headerClassName,
            )}
            aria-expanded={expanded}
          >
            {headerInner}
          </button>
        ) : (
          <div
            className={cn(
              "inline-flex max-w-full items-center gap-1.5",
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
            "agent-trace__collapse grid transition-[grid-template-rows,opacity] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)]",
            showBody
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-90",
            contentClassName,
          )}
          aria-hidden={!showBody}
        >
          <div className="min-h-0 overflow-hidden">
            <div className={cn(!hideHeader && "pt-1")}>{children}</div>
          </div>
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
