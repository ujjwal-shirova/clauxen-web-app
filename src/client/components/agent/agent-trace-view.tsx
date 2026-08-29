"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Globe2, Search } from "lucide-react";
import type {
  AgentNarrationStep,
  AgentStep,
  AgentThinkingStep,
  AgentToolStep,
} from "@/lib/agent-trace";
import { cn } from "@/lib/utils";
import {
  formatElapsedSeconds,
  summarizeTraceSteps,
} from "@/lib/agent-trace-labels";
import { preserveScrollAnchorOnToggle } from "@/lib/chat-scroll-anchor";
import { StreamingTextFade } from "@/lib/streaming-text-fade";
import { AgentToolBlock } from "./agent-tool-blocks";
import { AgentTraceBlock } from "./agent-trace-primitives";

const WORK_DOT_FRAMES = [
  [
    [5.6, 5.6],
    [12, 5.6],
    [18.4, 5.6],
    [5.6, 12],
    [12, 12],
    [18.4, 12],
    [5.6, 18.4],
    [12, 18.4],
    [18.4, 18.4],
  ],
  [
    [12, 4.2],
    [17.5, 6.5],
    [19.8, 12],
    [17.5, 17.5],
    [12, 19.8],
    [6.5, 17.5],
    [4.2, 12],
    [6.5, 6.5],
    [12, 12],
  ],
  [
    [12, 3.8],
    [9.2, 8.5],
    [14.8, 8.5],
    [6.4, 13.2],
    [12, 13.2],
    [17.6, 13.2],
    [4.2, 18.6],
    [12, 18.6],
    [19.8, 18.6],
  ],
  [
    [12, 3.5],
    [14.2, 8.7],
    [19.8, 9.2],
    [15.6, 12.8],
    [17.2, 18.5],
    [12, 15.2],
    [6.8, 18.5],
    [8.4, 12.8],
    [4.2, 9.2],
  ],
] as const;

const WORK_DOT_KEY_TIMES = "0;0.16;0.28;0.41;0.53;0.66;0.78;0.91;1";

function dotValues(index: number, axis: 0 | 1): string {
  const [grid, circle, triangle, star] = WORK_DOT_FRAMES;
  return [
    grid[index][axis],
    grid[index][axis],
    circle[index][axis],
    circle[index][axis],
    triangle[index][axis],
    triangle[index][axis],
    star[index][axis],
    star[index][axis],
    grid[index][axis],
  ].join(";");
}

function MorphingWorkIcon({ active = true }: { active?: boolean }) {
  const settledDots = WORK_DOT_FRAMES[3];
  return (
    <span
      className={cn("agent-work-morph", !active && "agent-work-morph--settled")}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width="24" height="24">
        {WORK_DOT_FRAMES[0].map((point, index) => (
          <circle
            key={index}
            className="agent-work-dot"
            cx={active ? point[0] : settledDots[index][0]}
            cy={active ? point[1] : settledDots[index][1]}
            r="1.45"
            style={{ animationDelay: `${index * -90}ms` }}
          >
            {active ? (
              <>
                <animate
                  attributeName="cx"
                  dur="6.4s"
                  repeatCount="indefinite"
                  values={dotValues(index, 0)}
                  keyTimes={WORK_DOT_KEY_TIMES}
                />
                <animate
                  attributeName="cy"
                  dur="6.4s"
                  repeatCount="indefinite"
                  values={dotValues(index, 1)}
                  keyTimes={WORK_DOT_KEY_TIMES}
                />
              </>
            ) : null}
          </circle>
        ))}
      </svg>
    </span>
  );
}

function elapsedLabel(startedAtMs?: number, endedAtMs = Date.now()): string {
  if (!startedAtMs) return "0s";
  return formatElapsedSeconds(Math.max(0, endedAtMs - startedAtMs));
}

/** Live, layout-stable activity label shown from send until answer paint. */
export function AgentWorkingRow({
  startedAtMs: _startedAtMs,
  activeLabel,
  className,
}: {
  startedAtMs?: number;
  activeLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "agent-trace-enter flex min-h-5 items-center gap-1.5 py-0.5",
        className,
      )}
      data-agent-working-row="true"
      role="status"
      aria-live="polite"
    >
      <MorphingWorkIcon />
      <span className="min-w-0 truncate text-[14px] font-normal leading-6 tracking-[-0.01em]">
        <span className="shimmer-text" data-shimmer-active="true">
          {activeLabel ?? "Working"}
        </span>
      </span>
    </div>
  );
}

function ThinkingTraceRow({ step }: { step: AgentThinkingStep }) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const content = step.content?.trim() ?? "";

  useEffect(() => {
    if (!step.isStreaming) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step.isStreaming]);

  const seconds = step.isStreaming
    ? Math.max(1, Math.floor((now - (step.startedAtMs ?? now)) / 1000))
    : Math.max(1, step.durationSeconds ?? 1);

  return (
    <div className="agent-thought-step min-w-0" data-agent-thinking-step="true">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="group/thought no-hover no-hover-overlay inline-flex min-h-6 max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left text-[14px] font-normal leading-6 text-zinc-500 shadow-none hover:bg-transparent focus-visible:outline-none"
        aria-expanded={expanded}
      >
        <span
          className={cn("truncate", step.isStreaming && "shimmer-text")}
          data-shimmer-active={step.isStreaming || undefined}
        >
          {step.isStreaming ? "Thinking" : "Thought"} for {seconds}s
        </span>
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-zinc-400 opacity-0 transition-[opacity,transform] duration-150 group-hover/thought:opacity-100 group-focus-visible/thought:opacity-100",
            expanded && "rotate-90 opacity-100",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200",
          expanded && content
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="agent-thinking-body max-w-[48rem] pt-1 pr-3 text-[14px] font-normal leading-6 text-zinc-500 dark:text-zinc-400">
            {step.isStreaming ? (
              <StreamingTextFade
                content={content}
                streamKey={`thinking-${step.id}`}
                className="whitespace-pre-wrap break-words text-inherit"
              />
            ) : (
              <p className="whitespace-pre-wrap break-words">{content}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type TraceDisplayRow =
  | { kind: "step"; step: AgentStep }
  | { kind: "searches"; id: string; tools: AgentToolStep[] };

function groupTraceRows(steps: AgentStep[]): TraceDisplayRow[] {
  const rows: TraceDisplayRow[] = [];
  for (const step of steps) {
    if (step.kind === "tool" && step.name === "web_search") {
      const previous = rows[rows.length - 1];
      if (previous?.kind === "searches") {
        previous.tools.push(step);
      } else {
        rows.push({
          kind: "searches",
          id: `searches-${step.id}`,
          tools: [step],
        });
      }
      continue;
    }
    rows.push({ kind: "step", step });
  }
  return rows;
}

function SearchTraceGroup({ tools }: { tools: AgentToolStep[] }) {
  const running = tools.some((tool) => tool.status === "running");
  return (
    <AgentTraceBlock
      leading={<Search className="size-4 text-zinc-500" strokeWidth={1.8} />}
      title={
        <span
          className={cn(running && "shimmer-text")}
          data-shimmer-active={running || undefined}
        >
          {running ? "Searching the web" : "Searched the web"}
        </span>
      }
      isActive={running}
      defaultExpanded={false}
      chevronMode="hover"
      titleClassName="text-zinc-500 dark:text-zinc-400"
      className="agent-search-group"
    >
      <div className="ml-2 flex max-w-[48rem] flex-col gap-3 border-l border-zinc-200 py-1.5 pl-5 dark:border-zinc-700">
        {tools.map((tool) => {
          const query =
            tool.searchQuery ||
            (typeof tool.args?.query === "string" ? tool.args.query : "");
          return (
            <p
              key={tool.id}
              className="flex min-w-0 items-center gap-2 text-[14px] leading-6 text-zinc-500"
            >
              <Globe2
                className="size-4 shrink-0 text-zinc-500"
                strokeWidth={1.7}
              />
              <span className="min-w-0 truncate">
                <span className="text-zinc-600 dark:text-zinc-300">
                  {tool.status === "running"
                    ? "Searching web for"
                    : "Searched web for"}
                </span>{" "}
                <span className="font-mono text-zinc-400">
                  {query || "the web"}
                </span>
              </span>
            </p>
          );
        })}
      </div>
    </AgentTraceBlock>
  );
}

function TraceSteps({
  steps,
  renderNarration,
}: {
  steps: AgentStep[];
  renderNarration?: (step: AgentNarrationStep) => ReactNode;
}) {
  const rows = groupTraceRows(steps);
  return (
    <div
      className="agent-trace-timeline flex min-w-0 flex-col gap-2"
      data-agent-trace-steps="true"
    >
      {rows.map((row) => {
        if (row.kind === "searches") {
          return (
            <div
              className="agent-trace-timeline__step agent-trace-enter ml-5 min-w-0"
              key={row.id}
            >
              <SearchTraceGroup tools={row.tools} />
            </div>
          );
        }
        const step = row.step;
        if (step.kind === "thinking") {
          return (
            <div
              className="agent-trace-timeline__step agent-trace-enter ml-5 min-w-0"
              key={step.id}
            >
              <ThinkingTraceRow step={step} />
            </div>
          );
        }
        if (step.kind === "narration") {
          if (!step.content.trim() || !renderNarration) return null;
          return (
            <div
              className="agent-trace-timeline__step agent-trace-timeline__step--narration agent-trace-enter min-w-0"
              key={step.id}
            >
              {renderNarration(step)}
            </div>
          );
        }
        return (
          <div
            className="agent-trace-timeline__step agent-trace-enter ml-5 min-w-0"
            key={step.id}
          >
            <AgentToolBlock tool={step} />
          </div>
        );
      })}
    </div>
  );
}

function CompletedTrace({
  steps,
  startedAtMs,
  completedAtMs,
  renderNarration,
}: {
  steps: AgentStep[];
  startedAtMs?: number;
  completedAtMs?: number;
  renderNarration?: (step: AgentNarrationStep) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const duration = elapsedLabel(startedAtMs, completedAtMs ?? startedAtMs);
  const summary = summarizeTraceSteps(steps) ?? `Worked for ${duration}`;

  return (
    <div
      className="min-w-0"
      data-agent-completed-trace="true"
      data-expanded={expanded || undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() =>
          preserveScrollAnchorOnToggle(buttonRef.current, () => {
            setExpanded((value) => !value);
          })
        }
        className="group/worked no-hover no-hover-overlay inline-flex min-h-6 max-w-full items-center gap-2 border-0 bg-transparent p-0 text-left text-[14px] font-normal leading-6 tracking-[-0.01em] text-zinc-500 shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0 dark:text-zinc-400"
        aria-expanded={expanded}
      >
        <span className="truncate">{summary}</span>
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-zinc-400 opacity-0 transition-[opacity,transform] duration-180 group-hover/worked:opacity-100 group-focus-visible/worked:opacity-100",
            expanded && "rotate-90 opacity-100",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-280 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-1.5">
            <TraceSteps steps={steps} renderNarration={renderNarration} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ordered activity trace followed by a live timer, collapsed when complete. */
export function AgentTraceView({
  steps,
  isActive,
  startedAtMs,
  completedAtMs,
  keepExpanded,
  renderNarration,
}: {
  steps: AgentStep[];
  isActive: boolean;
  startedAtMs?: number;
  completedAtMs?: number;
  /** Actionable traces (for example ask-user-input) must remain visible. */
  keepExpanded?: boolean;
  renderNarration?: (step: AgentNarrationStep) => ReactNode;
}) {
  const visibleSteps = useMemo(() => steps, [steps]);
  if (!isActive) {
    if (visibleSteps.length === 0) return null;
    if (keepExpanded) {
      return (
        <TraceSteps steps={visibleSteps} renderNarration={renderNarration} />
      );
    }
    const lastStepCompletedAtMs = visibleSteps.reduce(
      (latest, step) => Math.max(latest, step.completedAtMs ?? 0),
      0,
    );
    return (
      <CompletedTrace
        steps={visibleSteps}
        startedAtMs={startedAtMs}
        completedAtMs={(completedAtMs ?? lastStepCompletedAtMs) || undefined}
        renderNarration={renderNarration}
      />
    );
  }

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1.5"
      data-agent-trace-view="true"
    >
      <div>
        <TraceSteps steps={visibleSteps} renderNarration={renderNarration} />
      </div>
    </div>
  );
}
