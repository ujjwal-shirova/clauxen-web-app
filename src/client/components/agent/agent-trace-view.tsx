"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ExternalLink, Search } from "lucide-react";
import type {
  AgentStep,
  AgentThinkingStep,
  AgentToolStep,
} from "@/lib/agent-trace";
import { domainFromUrl } from "@/lib/agent-trace";
import { cn } from "@/lib/utils";
import {
  formatElapsedSeconds,
  runningToolLabel,
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
  startedAtMs,
  activeLabel,
  className,
}: {
  startedAtMs?: number;
  activeLabel?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
          {activeLabel ?? "Working"} for {elapsedLabel(startedAtMs, now)}
        </span>
      </span>
    </div>
  );
}

function ThinkingTraceRow({ step }: { step: AgentThinkingStep }) {
  const [expanded, setExpanded] = useState(step.isStreaming === true);
  const [now, setNow] = useState(() => Date.now());
  const content = step.content?.trim() ?? "";

  useEffect(() => {
    if (!step.isStreaming) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step.isStreaming]);

  useEffect(() => {
    if (step.isStreaming) setExpanded(true);
    else setExpanded(false);
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
          <div className="max-w-[48rem] pt-1 pr-3 text-[14px] font-normal leading-6 text-zinc-600 dark:text-zinc-300">
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
  const count = tools.length;
  return (
    <AgentTraceBlock
      leading={<Search className="size-4 text-zinc-500" strokeWidth={1.8} />}
      title={
        <span
          className={cn(running && "shimmer-text")}
          data-shimmer-active={running || undefined}
        >
          {running
            ? "Searching the web"
            : `Ran ${count} ${count === 1 ? "search" : "searches"}`}
        </span>
      }
      isActive={running}
      defaultExpanded={running}
      chevronMode="hover"
      titleClassName="text-zinc-500 dark:text-zinc-400"
      className="agent-search-group"
    >
      <div className="flex max-w-[48rem] flex-col gap-3 py-1.5 pl-[22px]">
        {tools.map((tool) => {
          const query =
            tool.searchQuery ||
            (typeof tool.args?.query === "string" ? tool.args.query : "");
          const results = tool.searchResults ?? [];
          return (
            <div key={tool.id} className="min-w-0">
              <p className="truncate text-[13px] leading-5 text-zinc-500">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {tool.status === "running" ? "Searching" : "Searched"}
                </span>{" "}
                {query || "the web"}
              </p>
              {results.length > 0 ? (
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {results.slice(0, 8).map((result, index) => {
                    const domain = domainFromUrl(result.url);
                    return (
                      <a
                        key={`${result.url}-${index}`}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/source flex min-w-0 items-start gap-2 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-2 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700/80 dark:bg-zinc-900/40 dark:hover:bg-zinc-900"
                      >
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
                          alt=""
                          loading="lazy"
                          className="mt-0.5 h-4 w-4 shrink-0 rounded-[3px]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 block text-[12.5px] font-medium leading-4 text-zinc-800 dark:text-zinc-200">
                            {result.title || domain}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] leading-4 text-zinc-400">
                            {domain}
                          </span>
                        </span>
                        <ExternalLink className="mt-0.5 size-3 shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover/source:opacity-100" />
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AgentTraceBlock>
  );
}

function TraceSteps({ steps }: { steps: AgentStep[] }) {
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
              className="agent-trace-timeline__step agent-trace-enter min-w-0"
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
              className="agent-trace-timeline__step agent-trace-enter min-w-0"
              key={step.id}
            >
              <ThinkingTraceRow step={step} />
            </div>
          );
        }
        if (step.kind === "narration") return null;
        return (
          <div
            className="agent-trace-timeline__step agent-trace-enter min-w-0"
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
}: {
  steps: AgentStep[];
  startedAtMs?: number;
  completedAtMs?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const duration = elapsedLabel(startedAtMs, completedAtMs ?? startedAtMs);

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
        <span className="truncate">Worked for {duration}</span>
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
          <div className="pt-1.5 pl-5">
            <TraceSteps steps={steps} />
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
}: {
  steps: AgentStep[];
  isActive: boolean;
  startedAtMs?: number;
  completedAtMs?: number;
  /** Actionable traces (for example ask-user-input) must remain visible. */
  keepExpanded?: boolean;
}) {
  const visibleSteps = useMemo(
    () => steps.filter((step) => step.kind !== "narration"),
    [steps],
  );
  const lastRunningTool = [...visibleSteps]
    .reverse()
    .find(
      (step): step is AgentToolStep =>
        step.kind === "tool" && step.status === "running",
    );

  if (!isActive) {
    if (visibleSteps.length === 0) return null;
    if (keepExpanded) return <TraceSteps steps={visibleSteps} />;
    const lastStepCompletedAtMs = visibleSteps.reduce(
      (latest, step) => Math.max(latest, step.completedAtMs ?? 0),
      0,
    );
    return (
      <CompletedTrace
        steps={visibleSteps}
        startedAtMs={startedAtMs}
        completedAtMs={(completedAtMs ?? lastStepCompletedAtMs) || undefined}
      />
    );
  }

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1.5"
      data-agent-trace-view="true"
    >
      <TraceSteps steps={visibleSteps} />
      <AgentWorkingRow
        startedAtMs={startedAtMs}
        activeLabel={
          lastRunningTool ? runningToolLabel(lastRunningTool) : undefined
        }
      />
    </div>
  );
}
