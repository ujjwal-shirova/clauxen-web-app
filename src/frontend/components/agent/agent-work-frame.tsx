"use client";

import { useMemo } from "react";
import { cn } from "@/frontend/lib/utils";
import type {
  AgentSegment,
  AgentTextSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/frontend/lib/agent-segments";
import {
  ASKED_QUESTIONS_LABEL,
  ASKING_QUESTIONS_LABEL,
  toolActionPhraseForName,
} from "@/frontend/lib/agent-frame-label";
import { AgentCogitatingStatus } from "./agent-cogitating-status";
import {
  AgentActionLabel,
  AgentTranscriptDone,
} from "./agent-transcript-chrome";
import { AgentThinkingStep } from "./agent-thinking-step";
import { AgentNarrativeStep } from "./agent-narrative-step";
import { AgentToolBlock } from "./agent-tool-blocks";

function isThinkingSegment(
  segment: AgentSegment,
): segment is AgentThinkingSegment {
  return segment.kind === "thinking";
}

function isToolSegment(segment: AgentSegment): segment is AgentToolSegment {
  return segment.kind === "tool";
}

function isTextSegment(segment: AgentSegment): segment is AgentTextSegment {
  return segment.kind === "text";
}

function workSegments(segments: AgentSegment[]) {
  return segments.filter(
    (segment) =>
      segment.kind === "thinking" ||
      segment.kind === "tool" ||
      segment.kind === "text",
  );
}

/**
 * Anthropic-style agentic transcript — chronological interleaved thinking,
 * tool actions, and serif narration (not a collapsed "Worked for" chip).
 *
 * Visual language (from Clauxen Code + Anthropic transcript patterns):
 * - Cogitating spark while extended thinking streams
 * - Clock + sans thinking lines
 * - Light action labels ("Searched the web") above tool cards
 * - Serif narration for mid-turn user-facing prose
 * - Checkmark Done when a tool phase completes
 */
export function AgentWorkFrame({
  segments,
  isStreaming,
  frameComplete,
}: {
  segments: AgentSegment[];
  isStreaming: boolean;
  frameComplete: boolean;
  startedAtMs?: number;
  completedAtMs?: number;
}) {
  const items = useMemo(() => workSegments(segments), [segments]);
  const askTools = items.filter(
    (segment): segment is AgentToolSegment =>
      isToolSegment(segment) && segment.name === "ask_user_input_v0",
  );
  const activityItems = items.filter(
    (segment) =>
      !(isToolSegment(segment) && segment.name === "ask_user_input_v0"),
  );
  const askOnly = askTools.length > 0 && activityItems.length === 0;
  const askRunning = askTools.some((tool) => tool.status === "running");
  const turnFinished = frameComplete && !isStreaming;

  const thinkingStreaming = activityItems.some(
    (segment) => isThinkingSegment(segment) && segment.isStreaming,
  );
  const hasRunningTool = activityItems.some(
    (segment) => isToolSegment(segment) && segment.status === "running",
  );
  const showCogitating =
    isStreaming &&
    thinkingStreaming &&
    !hasRunningTool &&
    activityItems.every(
      (segment) =>
        isThinkingSegment(segment) ||
        (isTextSegment(segment) && !segment.content.trim()),
    );

  const hasCompletedTool = activityItems.some(
    (segment) => isToolSegment(segment) && segment.status === "done",
  );
  const showDone =
    hasCompletedTool &&
    (turnFinished ||
      (!hasRunningTool &&
        !thinkingStreaming &&
        activityItems.some(isTextSegment)));

  if (items.length === 0) return null;

  if (askOnly) {
    return (
      <div
        className="mb-3 w-full min-w-0"
        data-agent-work-frame="true"
        data-agent-ask-label="true"
      >
        <span
          className={cn(
            "inline-flex max-w-full truncate text-[13.5px] font-medium leading-5",
            askRunning || (isStreaming && !turnFinished)
              ? "shimmer-text"
              : "text-zinc-500",
          )}
        >
          {askRunning || (isStreaming && !turnFinished)
            ? ASKING_QUESTIONS_LABEL
            : ASKED_QUESTIONS_LABEL}
        </span>
      </div>
    );
  }

  return (
    <div
      className="mb-3 flex w-full min-w-0 flex-col gap-2.5"
      data-agent-work-frame="true"
      data-agent-transcript="true"
      data-agent-frame-complete={turnFinished || undefined}
    >
      {showCogitating ? <AgentCogitatingStatus /> : null}

      {activityItems.map((segment, index) => {
        if (isThinkingSegment(segment)) {
          if (!segment.content.trim() && !segment.isStreaming) return null;
          // Hide empty streaming thinking when Cogitating header is enough
          if (
            showCogitating &&
            segment.isStreaming &&
            !segment.content.trim()
          ) {
            return null;
          }
          return <AgentThinkingStep key={segment.id} segment={segment} />;
        }

        if (isTextSegment(segment)) {
          return <AgentNarrativeStep key={segment.id} segment={segment} />;
        }

        if (isToolSegment(segment)) {
          const prev = activityItems[index - 1];
          const showLabel =
            !prev ||
            !isToolSegment(prev) ||
            prev.name !== segment.name;
          return (
            <div
              key={segment.id}
              className="flex min-w-0 flex-col gap-1.5"
              data-agent-tool-group={segment.name}
            >
              {showLabel ? (
                <AgentActionLabel active={segment.status === "running"}>
                  {toolActionPhraseForName(segment.name, segment.status)}
                </AgentActionLabel>
              ) : null}
              <AgentToolBlock tool={segment} />
            </div>
          );
        }

        return null;
      })}

      {showDone ? <AgentTranscriptDone /> : null}
    </div>
  );
}
