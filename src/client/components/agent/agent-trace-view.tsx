"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  BookOpen,
  Brain,
  ChevronRight,
  CloudSun,
  Code2,
  FileText,
  Globe2,
  ImageIcon,
  Link2,
  MapPin,
  MessageCircleQuestion,
  PencilLine,
  Plug,
  Search,
  Terminal,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  AgentNarrationStep,
  AgentStep,
  AgentThinkingStep,
  AgentToolStep,
} from "@/lib/agent-trace";
import { cn } from "@/lib/utils";
import {
  activeStepLabel,
  formatElapsedSeconds,
  formatStepDuration,
  stepDurationMs,
  summarizeTraceSteps,
  traceElapsedMs,
  traceStepIcon,
  type TraceStepIcon,
} from "@/lib/agent-trace-labels";
import { preserveScrollAnchorOnToggle } from "@/lib/chat-scroll-anchor";
import { StreamingTextFade } from "@/lib/streaming-text-fade";
import { AgentToolBlock, AgentWebSearchBlock } from "./agent-tool-blocks";
import { AgentShimmerText } from "./agent-trace-primitives";

/**
 * Agent trace — the visible "what the agent did" ledger for one turn.
 *
 *   header    live "Working for 12s · Searching for …" while the turn runs,
 *             settling into a persisted "Worked for 12s · Ran 2 searches"
 *             receipt that toggles the timeline.
 *   timeline  one row per step on a vertical rail: typed icon node, the
 *             step's own expandable detail block, and its wall time.
 */

const STEP_ICONS: Record<TraceStepIcon, LucideIcon> = {
  thinking: Brain,
  search: Search,
  fetch: Link2,
  terminal: Terminal,
  code: Code2,
  read: FileText,
  edit: PencilLine,
  skill: BookOpen,
  connector: Plug,
  places: MapPin,
  weather: CloudSun,
  image: ImageIcon,
  ask: MessageCircleQuestion,
  tool: Wrench,
};

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

/**
 * Latch the earliest start stamp seen across renders. Stream props arrive in
 * stages (optimistic createdAt → trace.startedAtMs → step.startedAtMs) and a
 * later stamp must never push the live clock forward — that forward jump is
 * what made "Working for 2s" snap back to "Working for 0s".
 */
function useLatchedStartedAtMs(startedAtMs?: number): number | undefined {
  const ref = useRef<number | undefined>(startedAtMs);
  if (
    startedAtMs !== undefined &&
    (ref.current === undefined || startedAtMs < ref.current)
  ) {
    ref.current = startedAtMs;
  }
  return ref.current;
}

/** Wall clock that ticks on whole seconds while `live`, frozen otherwise. */
function useTickingNow(live: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    let interval: number | undefined;
    const align = window.setTimeout(
      () => {
        setNow(Date.now());
        interval = window.setInterval(() => setNow(Date.now()), 1000);
      },
      1000 - (Date.now() % 1000),
    );
    return () => {
      window.clearTimeout(align);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [live]);
  return now;
}

function headerDuration(ms: number | null): string {
  return formatElapsedSeconds(Math.max(1000, ms ?? 1000));
}

/* ─────────────────────────── header ─────────────────────────── */

function AgentRunHeader({
  live,
  elapsedMs,
  subtitle,
  failedCount = 0,
  expandable,
  expanded,
  onToggle,
  buttonRef,
}: {
  live: boolean;
  elapsedMs: number | null;
  subtitle?: string | null;
  failedCount?: number;
  expandable: boolean;
  expanded: boolean;
  onToggle?: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const duration = headerDuration(elapsedMs);
  const label = live ? `Working for ${duration}` : `Worked for ${duration}`;

  const inner = (
    <>
      <span className="agent-run__header-icon">
        <MorphingWorkIcon active={live} />
      </span>
      <span className="agent-run__header-text">
        <span
          className={cn("agent-run__header-label", live && "shimmer-text")}
          data-shimmer-active={live || undefined}
        >
          {label}
        </span>
        {subtitle ? (
          <span className="agent-run__header-subtitle" title={subtitle}>
            <span aria-hidden>{"\u00a0·\u00a0"}</span>
            {subtitle}
          </span>
        ) : null}
        {failedCount > 0 ? (
          <span className="agent-run__header-failed">
            <span aria-hidden>{"\u00a0·\u00a0"}</span>
            {failedCount} failed
          </span>
        ) : null}
      </span>
      {expandable ? (
        <ChevronRight
          className={cn(
            "agent-run__header-chevron",
            expanded && "agent-run__header-chevron--open",
          )}
          aria-hidden
        />
      ) : null}
    </>
  );

  if (!expandable) {
    return (
      <div
        className="agent-run__header"
        role={live ? "status" : undefined}
        aria-live={live ? "polite" : undefined}
        data-agent-working-row={live || undefined}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      className="agent-run__header agent-run__header--button no-hover no-hover-overlay"
      aria-expanded={expanded}
      aria-live={live ? "polite" : undefined}
      data-agent-working-row={live || undefined}
    >
      {inner}
    </button>
  );
}

/** Live, layout-stable activity header shown from send until work appears. */
export function AgentWorkingRow({
  startedAtMs,
  activeLabel,
  className,
}: {
  startedAtMs?: number;
  activeLabel?: string;
  className?: string;
}) {
  const latchedStart = useLatchedStartedAtMs(startedAtMs);
  const now = useTickingNow(true);
  const elapsed = traceElapsedMs({
    startedAtMs: latchedStart,
    live: true,
    nowMs: now,
  });
  return (
    <div className={cn("agent-run agent-trace-enter", className)}>
      <AgentRunHeader
        live
        elapsedMs={elapsed}
        subtitle={activeLabel}
        expandable={false}
        expanded={false}
      />
    </div>
  );
}

/* ─────────────────────────── timeline ─────────────────────────── */

type TraceDisplayRow =
  | { kind: "step"; id: string; step: AgentStep }
  | { kind: "searches"; id: string; tools: AgentToolStep[] };

function groupTraceRows(steps: AgentStep[]): TraceDisplayRow[] {
  const rows: TraceDisplayRow[] = [];
  for (const step of steps) {
    if (step.kind === "tool" && step.name === "web_search") {
      const previous = rows[rows.length - 1];
      if (previous?.kind === "searches") {
        previous.tools.push(step);
      } else {
        rows.push({ kind: "searches", id: `searches-${step.id}`, tools: [step] });
      }
      continue;
    }
    rows.push({ kind: "step", id: step.id, step });
  }
  return rows;
}

type NodeStatus = "running" | "done" | "error";

function stepStatus(step: AgentStep): NodeStatus {
  if (step.kind === "tool") return step.status;
  return step.isStreaming ? "running" : "done";
}

function TimelineRow({
  icon,
  status,
  durationMs,
  children,
}: {
  /** null renders a quiet dot — used for interleaved narration prose. */
  icon: TraceStepIcon | null;
  status: NodeStatus;
  durationMs?: number | null;
  children: ReactNode;
}) {
  const Icon = icon ? STEP_ICONS[icon] : null;
  return (
    <li
      className="agent-run__step agent-trace-enter"
      data-status={status}
      data-icon={icon ?? "narration"}
    >
      <span className="agent-run__node" aria-hidden>
        {Icon ? (
          <Icon className="agent-run__node-icon" strokeWidth={1.8} />
        ) : (
          <span className="agent-run__node-dot" />
        )}
      </span>
      <div className="agent-run__step-body">{children}</div>
      <span className="agent-run__step-meta">
        {typeof durationMs === "number" ? formatStepDuration(durationMs) : null}
      </span>
    </li>
  );
}

function ThinkingStepContent({ step }: { step: AgentThinkingStep }) {
  const streaming = step.isStreaming === true;
  const content = step.content?.trim() ?? "";
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const latchedStart = useLatchedStartedAtMs(step.startedAtMs);
  const now = useTickingNow(streaming);
  const expanded = Boolean(content) && (userExpanded ?? streaming);

  const seconds = streaming
    ? Math.max(1, Math.floor((now - (latchedStart ?? now)) / 1000))
    : Math.max(1, step.durationSeconds ?? 1);

  return (
    <div className="agent-thought-step min-w-0" data-agent-thinking-step="true">
      <button
        ref={buttonRef}
        type="button"
        disabled={!content}
        onClick={() =>
          preserveScrollAnchorOnToggle(buttonRef.current, () => {
            setUserExpanded(!expanded);
          })
        }
        className="agent-run__step-title group/thought no-hover no-hover-overlay"
        aria-expanded={expanded}
      >
        <AgentShimmerText active={streaming}>
          <span className="agent-activity-label--primary">
            {streaming ? "Thinking" : "Thought"}
          </span>
          <span className="agent-activity-label--subtle">
            {" "}
            for {seconds}s
          </span>
        </AgentShimmerText>
        {content ? (
          <ChevronRight
            className={cn(
              "agent-run__inline-chevron group-hover/thought:opacity-100",
              expanded && "rotate-90 opacity-100",
            )}
            aria-hidden
          />
        ) : null}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "agent-run__thinking-body",
              streaming && "agent-run__thinking-body--live",
            )}
          >
            {streaming ? (
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

function SearchGroupContent({ tools }: { tools: AgentToolStep[] }) {
  const running = tools.some((tool) => tool.status === "running");
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const expanded = userExpanded ?? running;
  const sourceCount = tools.reduce(
    (total, tool) => total + (tool.searchResults?.length ?? 0),
    0,
  );
  const detail =
    tools.length === 1
      ? tools[0].searchQuery ||
        (typeof tools[0].args?.query === "string" ? tools[0].args.query : "")
      : `${tools.length} queries`;

  return (
    <div className="agent-search-group min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() =>
          preserveScrollAnchorOnToggle(buttonRef.current, () => {
            setUserExpanded(!expanded);
          })
        }
        className="agent-run__step-title group/search no-hover no-hover-overlay w-full min-w-0"
        aria-expanded={expanded}
        title={detail || undefined}
      >
        <AgentShimmerText active={running} className="min-w-0 flex-1 truncate">
          <span className="agent-activity-label--primary">
            {running ? "Searching the web" : "Searched the web"}
          </span>
          {detail ? (
            <span className="agent-activity-label--subtle"> {detail}</span>
          ) : null}
        </AgentShimmerText>
        {sourceCount > 0 && !running ? (
          <span className="agent-run__pill">
            {sourceCount} {sourceCount === 1 ? "source" : "sources"}
          </span>
        ) : null}
        <ChevronRight
          className={cn(
            "agent-run__inline-chevron group-hover/search:opacity-100",
            expanded && "rotate-90 opacity-100",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="agent-run__search-list">
            {tools.map((tool) => (
              <li key={tool.id} className="flex min-w-0 items-center gap-2">
                <Globe2
                  className="size-3.5 shrink-0 text-zinc-400"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <AgentWebSearchBlock tool={tool} variant="query" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function TraceTimeline({
  steps,
  nowMs,
  renderNarration,
}: {
  steps: AgentStep[];
  nowMs: number;
  renderNarration?: (step: AgentNarrationStep) => ReactNode;
}) {
  const rows = useMemo(() => groupTraceRows(steps), [steps]);
  if (rows.length === 0) return null;
  return (
    <ol className="agent-run__timeline" data-agent-trace-steps="true">
      {rows.map((row) => {
        if (row.kind === "searches") {
          const status: NodeStatus = row.tools.some((t) => t.status === "running")
            ? "running"
            : row.tools.every((t) => t.status === "error")
              ? "error"
              : "done";
          const started = Math.min(
            ...row.tools.map((t) => t.startedAtMs ?? Number.POSITIVE_INFINITY),
          );
          const ended =
            status === "running"
              ? nowMs
              : Math.max(...row.tools.map((t) => t.completedAtMs ?? 0));
          const durationMs =
            Number.isFinite(started) && ended >= started ? ended - started : null;
          if (row.tools.length === 1) {
            return (
              <TimelineRow
                key={row.id}
                icon="search"
                status={status}
                durationMs={durationMs}
              >
                <AgentWebSearchBlock tool={row.tools[0]} />
              </TimelineRow>
            );
          }
          return (
            <TimelineRow
              key={row.id}
              icon="search"
              status={status}
              durationMs={durationMs}
            >
              <SearchGroupContent tools={row.tools} />
            </TimelineRow>
          );
        }
        const step = row.step;
        const status = stepStatus(step);
        if (step.kind === "thinking") {
          return (
            <TimelineRow key={row.id} icon="thinking" status={status}>
              <ThinkingStepContent step={step} />
            </TimelineRow>
          );
        }
        if (step.kind === "narration") {
          if (!renderNarration) return null;
          return (
            <TimelineRow key={row.id} icon={null} status={status}>
              {renderNarration(step)}
            </TimelineRow>
          );
        }
        return (
          <TimelineRow
            key={row.id}
            icon={traceStepIcon(step)}
            status={status}
            durationMs={stepDurationMs(step, nowMs)}
          >
            <AgentToolBlock tool={step} />
          </TimelineRow>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────── trace view ─────────────────────────── */

/**
 * The whole agent trace for a turn. `isWorking` drives the header clock (the
 * turn has not finished); `isActive` keeps the timeline open while steps are
 * still streaming and no answer has started.
 */
export function AgentTraceView({
  steps,
  isActive,
  isWorking = isActive,
  startedAtMs,
  completedAtMs,
  keepExpanded,
  renderNarration,
}: {
  steps: AgentStep[];
  isActive: boolean;
  isWorking?: boolean;
  startedAtMs?: number;
  completedAtMs?: number;
  /** Actionable traces (for example ask-user-input) must remain visible. */
  keepExpanded?: boolean;
  /** When provided, interim narration renders in order inside the timeline. */
  renderNarration?: (step: AgentNarrationStep) => ReactNode;
}) {
  const visibleSteps = useMemo(
    () =>
      steps.filter((step) =>
        step.kind === "narration"
          ? Boolean(renderNarration) &&
            !step.isFinal &&
            step.content.trim().length > 0
          : true,
      ),
    [renderNarration, steps],
  );
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const latchedStart = useLatchedStartedAtMs(startedAtMs);
  const now = useTickingNow(isWorking);

  const elapsedMs = traceElapsedMs({
    startedAtMs: latchedStart,
    completedAtMs,
    steps: visibleSteps,
    live: isWorking,
    nowMs: now,
  });
  const hasSteps = visibleSteps.length > 0;

  if (!hasSteps) {
    if (isWorking) {
      return (
        <div className="agent-run agent-trace-enter" data-agent-trace-view="true">
          <AgentRunHeader
            live
            elapsedMs={elapsedMs}
            expandable={false}
            expanded={false}
          />
        </div>
      );
    }
    if (elapsedMs === null) return null;
    return (
      <div className="agent-run" data-agent-completed-trace="true">
        <AgentRunHeader
          live={false}
          elapsedMs={elapsedMs}
          expandable={false}
          expanded={false}
        />
      </div>
    );
  }

  const expanded = keepExpanded || (userExpanded ?? isActive);
  const failedCount = visibleSteps.filter(
    (step) => step.kind === "tool" && step.status === "error",
  ).length;
  const subtitle = isWorking
    ? (activeStepLabel(visibleSteps) ?? (isActive ? null : "Writing answer"))
    : summarizeTraceSteps(visibleSteps);

  return (
    <div
      className="agent-run"
      data-agent-trace-view="true"
      data-agent-completed-trace={!isWorking || undefined}
      data-expanded={expanded || undefined}
      data-live={isWorking || undefined}
    >
      <AgentRunHeader
        live={isWorking}
        elapsedMs={elapsedMs}
        subtitle={subtitle}
        failedCount={failedCount}
        expandable={!keepExpanded}
        expanded={expanded}
        buttonRef={buttonRef}
        onToggle={() =>
          preserveScrollAnchorOnToggle(buttonRef.current, () => {
            setUserExpanded(!expanded);
          })
        }
      />
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <TraceTimeline
            steps={visibleSteps}
            nowMs={now}
            renderNarration={renderNarration}
          />
        </div>
      </div>
    </div>
  );
}
