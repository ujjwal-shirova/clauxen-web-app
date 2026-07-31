"use client";

import type { Message } from "@/lib/types";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import {
  agentAnswerDuplicatesInterim,
  mergeAgentFramesForDisplay,
  resolveAgentFrames,
} from "@/lib/agent-frames";
import {
  countActivitySteps,
  deriveLiveActivityLabel,
} from "@/lib/agent-activity-summary";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { StreamingOrbCursor } from "@/components/ui/streaming-orb-cursor";
import { collectMessageSources } from "@/lib/chat-sources";
import { SourcesInlineStrip } from "@/components/chat-sources";
import { shouldShowAssistantStreamingOrb } from "@/lib/streaming-orb-policy";
import {
  isAssistantGenerationError,
  toUserFacingChatError,
} from "@/lib/assistant-generation-error";
import { AgentTrace, AgentTraceBlock, AgentShimmerText } from "./agent-trace";
import { AgentThinkingPhase } from "./agent-thinking-phase";
import { AgentNarrationNote } from "./agent-narration-note";
import { AgentToolBlock } from "./agent-tool-blocks";
import { AgentPlanningNextMoves } from "./agent-planning-label";
import type {
  AgentNarrationSegment,
  AgentSegment,
  AgentTextSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/lib/agent-segments";

function isToolSegment(segment: AgentSegment): segment is AgentToolSegment {
  return segment.kind === "tool";
}

function traceSegments(segments: AgentSegment[]): AgentSegment[] {
  return segments.filter(
    (segment) =>
      segment.kind === "thinking" ||
      segment.kind === "narration" ||
      segment.kind === "text" ||
      segment.kind === "tool",
  );
}

function previousFileContent(
  segments: AgentSegment[],
  beforeIndex: number,
  path: string,
): string | undefined {
  if (!path) return undefined;
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (!isToolSegment(segment)) continue;
    if (segment.name !== "create_file" && segment.name !== "file_write") {
      continue;
    }
    const segmentPath =
      segment.filePath ??
      (typeof segment.args?.path === "string" ? segment.args.path : "");
    if (segmentPath !== path) continue;
    const content =
      segment.fileContent ??
      (typeof segment.args?.content === "string"
        ? segment.args.content
        : typeof segment.args?.file_text === "string"
          ? segment.args.file_text
          : undefined);
    if (typeof content === "string") return content;
  }
  return undefined;
}

function hasVisibleWork(segments: AgentSegment[]): boolean {
  return segments.some((segment) => {
    if (segment.kind === "thinking" || segment.kind === "tool") return true;
    if (segment.kind === "narration" || segment.kind === "text") {
      return Boolean(segment.content.trim()) || Boolean(segment.isStreaming);
    }
    return false;
  });
}

type AgentTimelineRow =
  | { kind: "narration"; segment: AgentNarrationSegment | AgentTextSegment }
  | { kind: "thinking"; segment: AgentThinkingSegment }
  | { kind: "tool"; segment: AgentToolSegment };

/**
 * Chronological transcript rows for the unified timeline: the model's
 * mid-turn narration prose, reasoning phases, and every tool/search/MCP call
 * interleaved in stream order. The promoted final answer (isFinal narration)
 * renders below the timeline, never inside it.
 */
function buildTimelineRows(segments: AgentSegment[]): AgentTimelineRow[] {
  const rows: AgentTimelineRow[] = [];
  for (const segment of segments) {
    if (segment.kind === "thinking") {
      rows.push({ kind: "thinking", segment });
      continue;
    }
    if (segment.kind === "tool") {
      if (segment.name === "present_files") continue;
      rows.push({ kind: "tool", segment });
      continue;
    }
    if (segment.kind === "narration" || segment.kind === "text") {
      if (segment.kind === "narration" && segment.isFinal) continue;
      if (!segment.content.trim() && !segment.isStreaming) continue;
      rows.push({ kind: "narration", segment });
    }
  }
  return rows;
}

/**
 * The one main timeline header for an assistant turn — the round-dotted fold
 * that holds thinking, searches, tool calls, MCP connectors, and narration in
 * chronological order. Shimmers with the live step while working, collapses
 * to an "N steps" summary once the answer takes over.
 */
function AgentMainTimeline({
  rows,
  flatSegments,
  isActive,
  steps,
  durationSeconds,
}: {
  rows: AgentTimelineRow[];
  flatSegments: AgentSegment[];
  isActive: boolean;
  steps: number;
  durationSeconds?: number;
}) {
  const indexById = new Map(
    flatSegments.map((segment, index) => [segment.id, index]),
  );
  const workSegments = flatSegments.filter(
    (segment): segment is AgentThinkingSegment | AgentToolSegment =>
      segment.kind === "thinking" || segment.kind === "tool",
  );

  const title = isActive ? (
    <AgentShimmerText active>
      <span className="agent-activity-label--muted">
        {deriveLiveActivityLabel(workSegments)}
      </span>
      <span className="agent-activity-label--subtle">…</span>
    </AgentShimmerText>
  ) : (
    <>
      <span className="agent-activity-label--muted">
        {steps > 0 ? `${steps} ${steps === 1 ? "step" : "steps"}` : "Worked"}
      </span>
      {typeof durationSeconds === "number" && durationSeconds > 0 ? (
        <span className="agent-activity-label--subtle">
          {" "}
          · {durationSeconds}s
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className="agent-main-timeline"
      data-active={isActive || undefined}
      data-agent-main-timeline="true"
    >
      <AgentTraceBlock
        title={title}
        leading={<span className="agent-main-timeline__dot" aria-hidden />}
        chevronMode="hover"
        isActive={isActive}
        defaultExpanded={isActive}
        className="agent-main-timeline__block"
        headerClassName="agent-main-timeline__header"
        contentClassName="agent-main-timeline__content"
        titleClassName="text-inherit"
      >
        <AgentTrace className="agent-activity-timeline">
          {rows.map((row) => {
            if (row.kind === "narration") {
              return (
                <div
                  key={row.segment.id}
                  className="agent-timeline-event agent-narration-event agent-work-group-enter min-w-0"
                  data-agent-timeline-row="narration"
                >
                  <AgentNarrationNote segment={row.segment} />
                </div>
              );
            }
            if (row.kind === "thinking") {
              return (
                <AgentThinkingPhase key={row.segment.id} segment={row.segment} />
              );
            }
            const segment = row.segment;
            const path =
              segment.filePath ??
              (typeof segment.args?.path === "string" ? segment.args.path : "");
            const prior =
              segment.name === "create_file" || segment.name === "file_write"
                ? previousFileContent(
                    flatSegments,
                    indexById.get(segment.id) ?? 0,
                    path,
                  )
                : undefined;
            return (
              <div
                key={segment.id}
                className="agent-timeline-event agent-work-group-enter min-w-0"
                data-agent-tool-group={segment.name}
              >
                <AgentToolBlock tool={segment} previousFileContent={prior} />
              </div>
            );
          })}
        </AgentTrace>
      </AgentTraceBlock>
    </div>
  );
}

/**
 * Agent transcript: ONE unified activity timeline (round-dot header holding
 * narration, thinking, searches, tool calls, and MCP steps in order), then
 * the readable final answer, then live search sources. Orb sits at the
 * bottom only while generating and before answer tokens.
 */
export function AgentOrchestrationView({
  message,
  detailLevel,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
}) {
  const frames = mergeAgentFramesForDisplay(resolveAgentFrames(message));
  const sources = collectMessageSources(message);
  const streaming = message.isStreaming === true;
  const answer = message.content.trim();
  const answerStreaming = streaming && answer.length > 0;
  const showOrb = shouldShowAssistantStreamingOrb({
    isStreaming: streaming,
    answerStreaming,
  });
  const suppressDuplicateAnswer =
    answer.length > 0 && agentAnswerDuplicatesInterim(message);

  const workFrames = frames.filter((frame) =>
    hasVisibleWork(traceSegments(frame.segments)),
  );
  const hasWork = workFrames.length > 0;

  // Fresh turn: bottom orb only until tools/thinking/answer paint.
  if (!hasWork && !answer) {
    if (!streaming) return null;
    return <AgentPlanningNextMoves showOrb={showOrb} />;
  }

  const flatSegments = workFrames.flatMap((frame) =>
    traceSegments(frame.segments),
  );
  const rows = buildTimelineRows(flatSegments);
  const workSegments = flatSegments.filter(
    (segment): segment is AgentThinkingSegment | AgentToolSegment =>
      segment.kind === "thinking" || segment.kind === "tool",
  );
  const steps = countActivitySteps(workSegments);

  const anyLive =
    workSegments.some(
      (segment) =>
        (segment.kind === "thinking" && segment.isStreaming) ||
        (segment.kind === "tool" && segment.status === "running"),
    ) || rows.some((row) => row.kind === "narration" && row.segment.isStreaming);
  const frameIncomplete = workFrames.some((frame) => !frame.complete);
  const isActive =
    streaming && rows.length > 0 && (anyLive || (frameIncomplete && !answer));

  let durationSeconds: number | undefined;
  if (
    !isActive &&
    workFrames.length > 0 &&
    workFrames.every((frame) => frame.complete)
  ) {
    const starts = workFrames
      .map((frame) => frame.startedAtMs)
      .filter((stamp): stamp is number => typeof stamp === "number" && stamp > 0);
    const end = Math.max(
      ...workFrames.map((frame) => frame.completedAtMs ?? 0),
    );
    const start = starts.length > 0 ? Math.min(...starts) : 0;
    if (start > 0 && end > start) {
      durationSeconds = Math.max(1, Math.round((end - start) / 1000));
    }
  }

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-3"
      data-message-id={message.id}
      data-assistant-content="true"
      data-agent-transcript-root="true"
    >
      {rows.length > 0 ? (
        <AgentMainTimeline
          rows={rows}
          flatSegments={flatSegments}
          isActive={isActive}
          steps={steps}
          durationSeconds={durationSeconds}
        />
      ) : null}

      {answer && !suppressDuplicateAnswer ? (
        <div
          data-agent-block="answer"
          className="agent-answer-body"
          data-assistant-final-answer="true"
        >
          {isAssistantGenerationError(message) ? (
            <p
              data-assistant-error="true"
              className="min-w-0 text-[15px] font-[430] leading-[1.55] text-red-600"
              role="alert"
            >
              {toUserFacingChatError(message.content)}
            </p>
          ) : (
            <AssistantContentRenderer
              content={message.content}
              messageId={message.id}
              isStreaming={streaming}
              streamKey={`${message.id}-answer`}
              detailLevel={detailLevel}
              agentArtifacts={message.agentArtifacts}
              {...({ sources } as any)}
            />
          )}
        </div>
      ) : null}

      {sources.length > 0 ? (
        <div
          data-agent-block="sources"
          data-sources-live={streaming || undefined}
          className="overflow-anchor-none"
        >
          <SourcesInlineStrip sources={sources} />
        </div>
      ) : null}

      {showOrb ? (
        <div
          className="flex items-center py-1 animate-in fade-in duration-200"
          data-streaming-orb="bottom"
        >
          <StreamingOrbCursor />
        </div>
      ) : null}
    </div>
  );
}
