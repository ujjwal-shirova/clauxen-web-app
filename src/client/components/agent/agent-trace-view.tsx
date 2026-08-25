"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AgentStep, AgentToolStep } from "@/lib/agent-trace";
import { cn } from "@/lib/utils";
import { formatElapsedSeconds, runningToolLabel } from "@/lib/agent-trace-labels";
import { preserveScrollAnchorOnToggle } from "@/lib/chat-scroll-anchor";
import { StreamingTextFade } from "@/lib/streaming-text-fade";
import { AgentToolBlock } from "./agent-tool-blocks";

function MorphingWorkIcon({ active = true }: { active?: boolean }) {
  return (
    <span
      className={cn("agent-work-morph", !active && "agent-work-morph--settled")}
      aria-hidden
    >
      <span data-shape="square" />
      <span data-shape="circle" />
      <span data-shape="triangle" />
      <span data-shape="star" />
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
      <span className="min-w-0 truncate text-[13px] font-[430] leading-5 tracking-[-0.01em]">
        <span className="shimmer-text" data-shimmer-active="true">
          {activeLabel ?? "Working"} for {elapsedLabel(startedAtMs, now)}
        </span>
      </span>
    </div>
  );
}

function NarrationTraceRow({
  step,
}: {
  step: Extract<AgentStep, { kind: "narration" }>;
}) {
  const content = step.content.trim();
  if (!content) return null;

  return (
    <div
      className="agent-narration agent-trace-enter min-w-0"
      data-agent-narration="true"
    >
      {step.isStreaming ? (
        <StreamingTextFade
          content={content}
          streamKey={`trace-${step.id}`}
          className="whitespace-pre-wrap break-words text-[13px] font-[430] leading-5 text-zinc-600 dark:text-zinc-300"
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-[13px] font-[430] leading-5">
          {content}
        </p>
      )}
    </div>
  );
}

function TraceSteps({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-agent-trace-steps="true">
      {steps.map((step) => {
        if (step.kind === "thinking") return null;
        if (step.kind === "narration") {
          return <NarrationTraceRow key={step.id} step={step} />;
        }
        return (
          <div className="agent-trace-enter min-w-0" key={step.id}>
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
        className="group/worked no-hover no-hover-overlay inline-flex min-h-5 max-w-full items-center gap-1.5 border-0 bg-transparent p-0 text-left text-[13px] font-[430] leading-5 tracking-[-0.01em] text-zinc-500 shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0 dark:text-zinc-400"
        aria-expanded={expanded}
      >
        <MorphingWorkIcon active={false} />
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
  hideFinalNarration,
}: {
  steps: AgentStep[];
  isActive: boolean;
  startedAtMs?: number;
  completedAtMs?: number;
  /** Actionable traces (for example ask-user-input) must remain visible. */
  keepExpanded?: boolean;
  hideFinalNarration?: boolean;
}) {
  const visibleSteps = useMemo(
    () =>
      hideFinalNarration
        ? steps.filter(
            (step) => !(step.kind === "narration" && step.isFinal === true),
          )
        : steps,
    [hideFinalNarration, steps],
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
