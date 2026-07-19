"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/frontend/lib/utils";

/**
 * Clauxen agent trace — a single chronological transcript for an assistant
 * turn. Thinking, narration, and tool blocks render in the exact order the
 * model emitted them (interleaved-thinking safe).
 *
 * Design language (intentionally distinct from Claude/ChatGPT):
 *  - No vertical rail with dots. Blocks own their own affordance.
 *  - A quiet hairline accent on the left of each block anchors order without
 *    imitating another product's timeline chrome.
 *  - Active blocks expand; idle blocks collapse smoothly.
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
      className={cn("agent-trace relative flex flex-col gap-2.5", className)}
      data-agent-trace="true"
    >
      {children}
    </div>
  );
}

export type AgentTraceVariant =
  | "thinking"
  | "narration"
  | "tool"
  | "search"
  | "bash"
  | "file"
  | "done";

const VARIANT_ACCENT: Record<AgentTraceVariant, string> = {
  thinking: "agent-trace__accent--thinking",
  narration: "agent-trace__accent--narration",
  tool: "agent-trace__accent--tool",
  search: "agent-trace__accent--search",
  bash: "agent-trace__accent--bash",
  file: "agent-trace__accent--file",
  done: "agent-trace__accent--done",
};

/**
 * One block in the trace. The variant owns the left accent color and the
 * row's semantic label. Active blocks auto-expand; idle blocks collapse to
 * just their header. Users can always click to toggle.
 */
export function AgentTraceBlock({
  variant = "tool",
  title,
  trailing,
  isActive = false,
  defaultExpanded,
  children,
  className,
  contentClassName,
}: {
  variant?: AgentTraceVariant;
  title: ReactNode;
  trailing?: ReactNode;
  isActive?: boolean;
  /** Override default expand behavior (active → open, idle → closed). */
  defaultExpanded?: boolean;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
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
        "agent-trace__block relative pl-3.5 animate-in fade-in duration-200 ease-out",
        className,
      )}
      data-agent-trace-block="true"
      data-agent-trace-variant={variant}
      data-active={isActive || undefined}
    >
      <span
        aria-hidden
        className={cn(
          "agent-trace__accent absolute left-0 top-1.5 bottom-1.5 w-px rounded-full",
          VARIANT_ACCENT[variant],
        )}
      />
      <div className="min-w-0">
        {canCollapse ? (
          <button
            type="button"
            onClick={toggle}
            className="agent-trace__header no-hover no-hover-overlay inline-flex max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0"
            aria-expanded={expanded}
          >
            <AgentTraceHeader title={title} trailing={trailing} />
          </button>
        ) : (
          <div className="inline-flex max-w-full items-center">
            <AgentTraceHeader title={title} trailing={trailing} />
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
    </div>
  );
}

function AgentTraceHeader({
  title,
  trailing,
}: {
  title: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      <span className="min-w-0 truncate text-[13px] font-medium leading-5 tracking-[-0.005em] text-zinc-700">
        {title}
      </span>
      {trailing ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 pl-0.5 text-[11.5px] tabular-nums text-zinc-400">
          {trailing}
        </span>
      ) : null}
    </span>
  );
}

/** Shimmering text for live/active labels. */
export function AgentShimmerText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("shimmer-text", className)}>{children}</span>
  );
}
