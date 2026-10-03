"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronRight } from "lucide-react";
import type {
  AgentNarrationStep,
  AgentStep,
  AgentThinkingStep,
  AgentToolStep,
} from "@/lib/agent-trace";
import { cn } from "@/lib/utils";
import {
  formatElapsedSeconds,
  formatStepDuration,
  runningToolLabel,
  stepDurationMs,
  traceElapsedMs,
} from "@/lib/agent-trace-labels";
import { preserveScrollAnchorOnToggle } from "@/lib/chat-scroll-anchor";
import { StreamingTextFade } from "@/lib/streaming-text-fade";
import { AgentToolBlock } from "./agent-tool-blocks";
import { AgentShimmerText } from "./agent-trace-primitives";
import { AgentWorkCursor } from "./agent-work-cursor";

/**
 * Agent trace for one turn.
 *
 * Design: one shimmering activity label folds open into an interleaved
 * ledger — a rounded, hairline-ruled container where every step the model
 * takes (thinking, its own progress labels, tool calls) is one expandable
 * row. The ledger stays open while the turn works and folds to the label
 * when the final answer lands; the label always says what the model is
 * doing so a collapsed run is still readable.
 */

const NARRATION_LABEL_MAX = 160;
const PLAIN_NARRATION_MAX = 96;

/** First line of a narration step, shortened for ledger/header labels. */
function narrationLabel(content: string): string {
  const firstLine =
    content
      .split("\n")
      .find((line) => line.trim())
      ?.trim() ?? "";
  if (!firstLine) return "";
  return firstLine.length > NARRATION_LABEL_MAX
    ? `${firstLine.slice(0, NARRATION_LABEL_MAX - 1).trimEnd()}…`
    : firstLine;
}

/** Short one-liners read as plain rows; longer narration folds behind a label. */
function isPlainNarration(content: string): boolean {
  const trimmed = content.trim();
  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length === 1 && trimmed.length <= PLAIN_NARRATION_MAX;
}

/** What the model is doing right now — the fold label for the whole ledger. */
function currentActivityLabel(steps: AgentStep[]): string | null {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step.kind === "tool" && step.status === "running") {
      return runningToolLabel(step);
    }
    if (step.kind === "thinking" && step.isStreaming) return "Thinking";
    if (step.kind === "narration" && step.isStreaming) {
      return narrationLabel(step.content) || "Writing";
    }
  }
  return null;
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
  activityLabel,
  failedCount = 0,
  expandable,
  expanded,
  onToggle,
  buttonRef,
}: {
  live: boolean;
  elapsedMs: number | null;
  /** Live step label. Replaces "Working for…" while a step is in progress. */
  activityLabel?: string | null;
  failedCount?: number;
  expandable: boolean;
  expanded: boolean;
  onToggle?: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const duration = headerDuration(elapsedMs);
  const label =
    live && activityLabel
      ? activityLabel
      : live
        ? `Working for ${duration}`
        : `Worked for ${duration}`;

  const inner = (
    <>
      <span className="agent-run__header-text">
        <AgentShimmerText
          active={live}
          className="agent-run__header-label"
        >
          {label}
        </AgentShimmerText>
        {live && activityLabel ? (
          <span className="agent-run__header-subtitle">{duration}</span>
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

/** Live, layout-stable activity row shown from send until work appears. */
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
        activityLabel={activeLabel}
        expandable={false}
        expanded={false}
      />
      <AgentWorkCursor />
    </div>
  );
}

/* ─────────────────────────── ledger rows ─────────────────────────── */

function LedgerRowShell({
  label,
  meta,
  live,
  expandable,
  expanded,
  onToggle,
  buttonRef,
  children,
}: {
  label: ReactNode;
  meta?: ReactNode;
  live?: boolean;
  expandable: boolean;
  expanded: boolean;
  onToggle?: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  children?: ReactNode;
}) {
  const head = (
    <>
      <span className="agent-ledger__row-label">{label}</span>
      {meta ? <span className="agent-ledger__row-meta">{meta}</span> : null}
      {expandable ? (
        <ChevronRight
          className={cn(
            "agent-ledger__row-chevron",
            expanded && "rotate-90",
          )}
          aria-hidden
        />
      ) : null}
    </>
  );

  return (
    <div
      className="agent-ledger__row"
      data-live={live || undefined}
      data-agent-ledger-row="true"
    >
      {expandable ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="agent-ledger__row-head no-hover no-hover-overlay"
        >
          {head}
        </button>
      ) : (
        <div className="agent-ledger__row-head">{head}</div>
      )}
      {expandable ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          aria-hidden={!expanded}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="agent-ledger__row-body">{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThinkingLedgerRow({
  step,
  nowMs,
}: {
  step: AgentThinkingStep;
  nowMs: number;
}) {
  const streaming = step.isStreaming === true;
  const content = step.content?.trim() ?? "";
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const latchedStart = useLatchedStartedAtMs(step.startedAtMs);
  const expanded = Boolean(content) && (userExpanded ?? streaming);

  const seconds = streaming
    ? Math.max(1, Math.floor((nowMs - (latchedStart ?? nowMs)) / 1000))
    : Math.max(1, step.durationSeconds ?? 1);

  return (
    <LedgerRowShell
      label={streaming ? "Thinking" : "Thought"}
      meta={`${seconds}s`}
      live={streaming}
      expandable={Boolean(content)}
      expanded={expanded}
      buttonRef={buttonRef}
      onToggle={() =>
        preserveScrollAnchorOnToggle(buttonRef.current, () => {
          setUserExpanded(!expanded);
        })
      }
    >
      <div
        className={cn(
          "whitespace-pre-wrap break-words text-[13px] leading-[1.6]",
          streaming
            ? "text-zinc-600 dark:text-zinc-300"
            : "text-zinc-500 dark:text-zinc-400",
        )}
      >
        {streaming ? (
          <StreamingTextFade
            content={content}
            streamKey={`thinking-${step.id}`}
            className="whitespace-pre-wrap break-words text-inherit"
          />
        ) : (
          <p>{content}</p>
        )}
      </div>
    </LedgerRowShell>
  );
}

function NarrationLedgerRow({
  step,
  nowMs,
  renderNarration,
}: {
  step: AgentNarrationStep;
  nowMs: number;
  renderNarration?: (step: AgentNarrationStep) => ReactNode;
}) {
  const content = step.content.trim();
  const streaming = step.isStreaming === true;
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  if (!content) return null;

  if (isPlainNarration(content)) {
    return (
      <LedgerRowShell
        label={content}
        live={streaming}
        expandable={false}
        expanded={false}
      >
        {null}
      </LedgerRowShell>
    );
  }

  const expanded = userExpanded ?? streaming;
  const ms = stepDurationMs(step, nowMs);
  const meta =
    ms != null && ms > 0 ? formatStepDuration(ms) : streaming ? "…" : undefined;

  return (
    <LedgerRowShell
      label={narrationLabel(content) || "Working"}
      meta={meta}
      live={streaming}
      expandable
      expanded={expanded}
      buttonRef={buttonRef}
      onToggle={() =>
        preserveScrollAnchorOnToggle(buttonRef.current, () => {
          setUserExpanded(!expanded);
        })
      }
    >
      {renderNarration ? (
        renderNarration(step)
      ) : (
        <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-zinc-500 dark:text-zinc-400">
          {content}
        </p>
      )}
    </LedgerRowShell>
  );
}

function ToolLedgerRow({ tool }: { tool: AgentToolStep }) {
  return (
    <div
      className="agent-ledger__row agent-ledger__row--tool"
      data-live={tool.status === "running" || undefined}
      data-agent-ledger-row="true"
    >
      <AgentToolBlock tool={tool} />
    </div>
  );
}

/**
 * One interleaved ledger for the turn: thinking, the model's own progress
 * labels, and tool calls in the order they happened. The ledger stays open
 * while work is in progress and folds when the final answer starts.
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
  /** Narration bodies, rendered inside the expanded row. */
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
  const latchedStart = useLatchedStartedAtMs(startedAtMs);
  const now = useTickingNow(isActive);
  const elapsed = traceElapsedMs({
    startedAtMs: latchedStart,
    completedAtMs,
    steps: visibleSteps,
    live: isActive,
    nowMs: now,
  });
  const [expanded, setExpanded] = useState(false);
  const userToggledRef = useRef(false);
  const headerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (keepExpanded) {
      setExpanded(true);
      return;
    }
    if (isActive) {
      // Open on its own while the run works; respect a manual fold.
      if (!userToggledRef.current) setExpanded(true);
      return;
    }
    userToggledRef.current = false;
    setExpanded(false);
  }, [isActive, keepExpanded]);

  const activityLabel = useMemo(
    () => currentActivityLabel(visibleSteps),
    [visibleSteps],
  );

  if (visibleSteps.length === 0) return null;

  const failedCount = visibleSteps.filter(
    (step) => step.kind === "tool" && step.status === "error",
  ).length;

  return (
    <div
      className="agent-run agent-trace-enter flex w-full min-w-0 flex-col"
      data-agent-trace-view="true"
      data-agent-completed-trace={!isActive || undefined}
      data-live={isActive || undefined}
    >
      <AgentRunHeader
        live={isActive}
        elapsedMs={elapsed}
        activityLabel={isActive ? activityLabel : null}
        failedCount={failedCount}
        expandable
        expanded={expanded}
        buttonRef={headerRef}
        onToggle={() => {
          userToggledRef.current = true;
          preserveScrollAnchorOnToggle(headerRef.current, () => {
            setExpanded((value) => !value);
          });
        }}
      />
      {expanded && visibleSteps.length > 0 ? (
        <div className="agent-ledger mt-2">
          {visibleSteps.map((step) => {
            if (step.kind === "thinking") {
              return <ThinkingLedgerRow key={step.id} step={step} nowMs={now} />;
            }
            if (step.kind === "narration") {
              return (
                <NarrationLedgerRow
                  key={step.id}
                  step={step}
                  nowMs={now}
                  renderNarration={renderNarration}
                />
              );
            }
            return <ToolLedgerRow key={step.id} tool={step} />;
          })}
        </div>
      ) : null}
    </div>
  );
}
