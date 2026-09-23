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
  formatElapsedSeconds,
  toolTraceFamily,
  toolTraceFamilyLabel,
  traceElapsedMs,
  traceStepIcon,
  type ToolTraceFamily,
  type TraceStepIcon,
} from "@/lib/agent-trace-labels";
import { preserveScrollAnchorOnToggle } from "@/lib/chat-scroll-anchor";
import { StreamingTextFade } from "@/lib/streaming-text-fade";
import { AgentToolBlock, AgentWebSearchBlock } from "./agent-tool-blocks";
import { AgentShimmerText, AgentTraceBlock } from "./agent-trace-primitives";
import { StreamingOrbCursor } from "@/components/ui/streaming-orb-cursor";

/**
 * Agent trace for one turn.
 *
 * Narration stays outside every tree, as prose between tool calls.
 * Each run of the same kind of tool (web search, command, MCP, …) is its
 * own collapsible. There is no parent "Worked for" tree.
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

/* ─────────────────────────── interleaved segments ─────────────────────────── */

type TraceSegment =
  | { kind: "narration"; id: string; step: AgentNarrationStep }
  | { kind: "thinking"; id: string; step: AgentThinkingStep }
  | {
      kind: "tools";
      id: string;
      family: ToolTraceFamily;
      tools: AgentToolStep[];
    };

/** Split a turn so narration never sits inside a tool tree. */
function partitionTrace(steps: AgentStep[]): TraceSegment[] {
  const segments: TraceSegment[] = [];
  let buffer: AgentToolStep[] = [];
  let family: ToolTraceFamily | null = null;

  const flush = () => {
    if (!buffer.length || !family) return;
    segments.push({
      kind: "tools",
      id: `tools-${buffer[0].id}`,
      family,
      tools: buffer,
    });
    buffer = [];
    family = null;
  };

  for (const step of steps) {
    if (step.kind === "narration") {
      flush();
      if (!step.isFinal && step.content.trim()) {
        segments.push({ kind: "narration", id: step.id, step });
      }
      continue;
    }
    if (step.kind === "thinking") {
      flush();
      segments.push({ kind: "thinking", id: step.id, step });
      continue;
    }
    const nextFamily = toolTraceFamily(step.name);
    if (family && nextFamily !== family) flush();
    family = nextFamily;
    buffer.push(step);
  }
  flush();
  return segments;
}

function ToolGroupTree({
  family,
  tools,
  forceOpen,
}: {
  family: ToolTraceFamily;
  tools: AgentToolStep[];
  forceOpen?: boolean;
}) {
  const live = tools.some((tool) => tool.status === "running");
  const failed = tools.some((tool) => tool.status === "error");
  const label = toolTraceFamilyLabel(family, tools.length, live);
  const iconName = traceStepIcon(tools[0]);
  const Icon = STEP_ICONS[iconName];

  return (
    <AgentTraceBlock
      className="agent-tool-tree"
      title={
        <AgentShimmerText active={live}>
          <span className={failed ? "text-rose-500" : "agent-activity-label--primary"}>
            {failed && !live ? `${label} failed` : label}
          </span>
        </AgentShimmerText>
      }
      leading={<Icon className="size-4" strokeWidth={1.8} aria-hidden />}
      chevronMode="always"
      defaultExpanded={Boolean(forceOpen) || live}
      isActive={live}
    >
      <div className="flex min-w-0 flex-col gap-2 pt-1">
        {tools.map((tool) =>
          tool.name === "web_search" ? (
            <AgentWebSearchBlock key={tool.id} tool={tool} />
          ) : (
            <AgentToolBlock key={tool.id} tool={tool} />
          ),
        )}
      </div>
    </AgentTraceBlock>
  );
}

/* ─────────────────────────── trace view ─────────────────────────── */

/**
 * Ordered agent activity for one turn. Narration renders as prose between
 * tool trees. Each tree covers one kind of tool call and collapses on its own.
 */
export function AgentTraceView({
  steps,
  isActive,
  isWorking = isActive,
  startedAtMs: _startedAtMs,
  completedAtMs: _completedAtMs,
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
  /** Interim narration, rendered outside every tool tree. */
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
  const segments = useMemo(
    () => partitionTrace(visibleSteps),
    [visibleSteps],
  );

  if (segments.length === 0) {
    if (!isWorking) return null;
    return (
      <div className="flex items-center py-1" data-agent-trace-view="true">
        <StreamingOrbCursor />
      </div>
    );
  }

  return (
    <div
      className="agent-trace-flow flex w-full min-w-0 flex-col gap-3"
      data-agent-trace-view="true"
      data-agent-completed-trace={!isWorking || undefined}
      data-live={isWorking || isActive || undefined}
    >
      {segments.map((segment) => {
        if (segment.kind === "narration") {
          return (
            <div
              key={segment.id}
              className="agent-trace-narration min-w-0"
              data-agent-narration="true"
            >
              {renderNarration?.(segment.step)}
            </div>
          );
        }
        if (segment.kind === "thinking") {
          return <ThinkingStepContent key={segment.id} step={segment.step} />;
        }
        const askOpen = segment.tools.some(
          (tool) => tool.name === "ask_user_input_v0",
        );
        return (
          <ToolGroupTree
            key={segment.id}
            family={segment.family}
            tools={segment.tools}
            forceOpen={Boolean(keepExpanded) && askOpen}
          />
        );
      })}
    </div>
  );
}
