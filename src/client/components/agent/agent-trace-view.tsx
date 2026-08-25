"use client";

import { useEffect, useState } from "react";
import { Search, Globe, Terminal, FileText, Plug } from "lucide-react";
import type { AgentStep, AgentToolStep } from "@/lib/agent-trace";
import { domainFromUrl } from "@/lib/agent-trace";
import { cn } from "@/lib/utils";
import {
  completedToolLabel,
  runningToolLabel,
  formatElapsedSeconds,
} from "@/lib/agent-trace-labels";

/**
 * Trace step icons — a single small leading glyph per row (Grok-style
 * status lines: icon + short label).
 */
function StepIcon({ step }: { step: AgentStep }) {
  if (step.kind === "thinking") {
    return <SparkleGlyph />;
  }
  if (step.kind === "narration") {
    return null; // narration renders as plain prose — no glyph
  }
  const className = "h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500";
  switch (step.name) {
    case "web_search":
    case "image_search":
    case "places_search":
      return <Search className={className} strokeWidth={1.75} aria-hidden />;
    case "web_fetch":
      return <Globe className={className} strokeWidth={1.75} aria-hidden />;
    case "bash_tool":
    case "execute_code":
      return <Terminal className={className} strokeWidth={1.75} aria-hidden />;
    case "create_file":
    case "file_write":
    case "file_read":
      return <FileText className={className} strokeWidth={1.75} aria-hidden />;
    default:
      if (step.name.startsWith("mcp__")) {
        return <Plug className={className} strokeWidth={1.75} aria-hidden />;
      }
      return (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600"
          aria-hidden
        />
      );
  }
}

function SparkleGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 1.5l1.2 3.6a4 4 0 001.7 1.7L14.5 8l-3.6 1.2a4 4 0 00-1.7 1.7L8 14.5 6.8 10.9a4 4 0 00-1.7-1.7L1.5 8l3.6-1.2a4 4 0 001.7-1.7L8 1.5z" />
    </svg>
  );
}

/** 3x3 dot grid processing indicator (as in the reference status row). */
export function WorkingDots({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-3.5 w-3.5 shrink-0 grid-cols-3 gap-[1.5px]",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className="h-[2px] w-[2px] rounded-full bg-zinc-400 dark:bg-zinc-500"
          style={{
            animation: `working-dot-pulse 1.2s ease-in-out ${index * 0.08}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Grok-style trailing status row: shimmering label + live elapsed timer.
 * Sits below the latest trace step while the assistant works.
 */
export function AgentWorkingRow({
  startedAtMs,
  activeLabel,
  className,
}: {
  startedAtMs?: number;
  /** Present-tense action ("Searching for …") or undefined for generic. */
  activeLabel?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = startedAtMs ? formatElapsedSeconds(now - startedAtMs) : null;
  const label = activeLabel ?? "Working";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 py-0.5 animate-in fade-in duration-200",
        className,
      )}
      data-agent-working-row="true"
    >
      <WorkingDots />
      <span className="min-w-0 truncate text-[13px] font-[430] leading-5 tracking-[-0.01em]">
        <span className="shimmer-text" data-shimmer-active="true">
          {label}
          {elapsed ? ` for ${elapsed}` : ""}
        </span>
      </span>
    </div>
  );
}

/**
 * One tool step row — past-tense summary when done ("Ran 1 search"),
 * present-tense + shimmer while running. Expandable body (command output,
 * search results) is rendered by the existing per-tool blocks.
 */
function ToolTraceRow({
  tool,
  children,
}: {
  tool: AgentToolStep;
  children?: React.ReactNode;
}) {
  const running = tool.status === "running";
  const hasBody = children != null && children !== false;

  const header = (
    <>
      <StepIcon step={tool} />
      {running ? (
        <AgentWorkingRowInline label={runningToolLabel(tool)} />
      ) : (
        <span
          className={cn(
            "min-w-0 truncate text-[13px] font-[430] leading-5 tracking-[-0.01em]",
            tool.status === "error"
              ? "text-rose-500"
              : "text-zinc-500 dark:text-zinc-400",
          )}
        >
          {completedToolLabel(tool)}
        </span>
      )}
    </>
  );

  if (!hasBody && !running) {
    return (
      <div
        className="agent-trace__row flex min-w-0 items-center gap-1.5"
        data-agent-trace-row={tool.toolCallId}
      >
        {header}
      </div>
    );
  }

  // Running or expandable rows use the collapsible block chrome.
  return (
    <CollapsibleTraceRow
      keyContent={header}
      defaultExpanded={running}
      toolCallId={tool.toolCallId}
    >
      {children}
    </CollapsibleTraceRow>
  );
}

function AgentWorkingRowInline({ label }: { label: string }) {
  return (
    <span className="min-w-0 truncate text-[13px] font-[430] leading-5 tracking-[-0.01em]">
      <span className="shimmer-text" data-shimmer-active="true">
        {label}
      </span>
    </span>
  );
}

function CollapsibleTraceRow({
  keyContent,
  children,
  defaultExpanded,
  toolCallId,
}: {
  keyContent: React.ReactNode;
  children?: React.ReactNode;
  defaultExpanded: boolean;
  toolCallId: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div
      className="agent-trace__row min-w-0"
      data-agent-trace-row={toolCallId}
      data-expanded={expanded || undefined}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="group/trace-row no-hover no-hover-overlay flex max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0"
        aria-expanded={expanded}
      >
        {keyContent}
      </button>
      {children != null ? (
        <div
          className="grid transition-[grid-template-rows,opacity] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            gridTemplateRows: expanded ? "1fr" : "0fr",
            opacity: expanded ? 1 : 0,
          }}
          aria-hidden={!expanded}
        >
          <div className="min-h-0 overflow-hidden pt-1">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

/** Narration row — first-person progress prose between work steps. */
function NarrationTraceRow({ content }: { content: string }) {
  return (
    <p
      className="agent-narration min-w-0 text-[15px] font-[430] leading-[1.55] text-zinc-700 dark:text-zinc-200"
      data-agent-narration="true"
    >
      {content}
    </p>
  );
}

/**
 * The full turn trace: ordered steps, then the trailing Working-for row
 * while anything is live.
 */
export function AgentTraceView({
  steps,
  isActive,
  startedAtMs,
  hideFinalNarration,
}: {
  steps: AgentStep[];
  isActive: boolean;
  startedAtMs?: number;
  /** Hide the final narration step that was promoted to the answer body. */
  hideFinalNarration?: boolean;
}) {
  const lastRunningTool = isActive
    ? [...steps]
        .reverse()
        .find(
          (step): step is AgentToolStep =>
            step.kind === "tool" && step.status === "running",
        )
    : undefined;

  const visibleSteps = hideFinalNarration
    ? steps.filter(
        (step) => !(step.kind === "narration" && step.isFinal === true),
      )
    : steps;

  if (visibleSteps.length === 0 && !isActive) return null;

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1.5"
      data-agent-trace-view="true"
    >
      {visibleSteps.map((step) => {
        if (step.kind === "narration") {
          return (
            <NarrationTraceRow key={step.id} content={step.content.trim()} />
          );
        }
        if (step.kind === "thinking") {
          // Presence-only phase — the trailing Working-for row carries it.
          return null;
        }
        return (
          <ToolTraceRow key={step.id} tool={step}>
            <ToolStepBody tool={step} />
          </ToolTraceRow>
        );
      })}

      {/* Trailing status: live tool label wins; otherwise generic timer. */}
      {isActive ? (
        <AgentWorkingRow
          startedAtMs={startedAtMs}
          activeLabel={
            lastRunningTool ? runningToolLabel(lastRunningTool) : undefined
          }
        />
      ) : null}
    </div>
  );
}

function ToolStepBody({ tool }: { tool: AgentToolStep }): React.ReactNode {
  // Rich bodies (search result cards, terminal panes, file blocks) are owned
  // by the per-tool components imported by the message renderer; this hook
  // point keeps them out of the flat ledger's critical path.
  void tool;
  return false as unknown as React.ReactNode;
}
