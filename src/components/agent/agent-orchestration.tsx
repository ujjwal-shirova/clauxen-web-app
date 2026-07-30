"use client";

import type { Message } from "@/lib/types";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import {
  agentAnswerDuplicatesInterim,
  mergeAgentFramesForDisplay,
  resolveAgentFrames,
} from "@/lib/agent-frames";
import { groupAgentWorkItems } from "@/lib/agent-work-groups";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { StreamingOrbCursor } from "@/components/ui/streaming-orb-cursor";
import { collectMessageSources } from "@/lib/chat-sources";
import { SourcesInlineStrip } from "@/components/chat-sources";
import { shouldShowAssistantStreamingOrb } from "@/lib/streaming-orb-policy";
import {
  isAssistantGenerationError,
  toUserFacingChatError,
} from "@/lib/assistant-generation-error";
import { AgentTrace } from "./agent-trace";
import { AgentWorkGroupView } from "./agent-work-group";
import { AgentThinkingPhase } from "./agent-thinking-phase";
import { AgentNarrationNote } from "./agent-narration-note";
import { AgentToolBlock } from "./agent-tool-blocks";
import { AgentPlanningNextMoves } from "./agent-planning-label";
import { AgentFaviconStack } from "./agent-favicon-stack";
import type {
  AgentSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/lib/agent-segments";

function isThinkingSegment(
  segment: AgentSegment,
): segment is AgentThinkingSegment {
  return segment.kind === "thinking";
}

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

/** Source URLs for favicon chips on a work-group header (web search). */
function groupSearchSourceUrls(
  segments: Array<AgentThinkingSegment | AgentToolSegment>,
): string[] {
  const urls: string[] = [];
  for (const segment of segments) {
    if (segment.kind !== "tool") continue;
    if (segment.name !== "web_search" && segment.name !== "web_fetch") continue;
    for (const row of segment.searchResults ?? []) {
      if (row.url) urls.push(row.url);
    }
  }
  return urls;
}

/**
 * Agent transcript: planning → narration outside timeline → tool groups → answer.
 * Orb sits at the bottom only while generating and before answer tokens.
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

  // Fresh turn: shimmer planning label + bottom orb until tools/thinking/answer.
  if (!hasWork && !answer) {
    if (!streaming) return null;
    return <AgentPlanningNextMoves showOrb={showOrb} />;
  }

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-3"
      data-message-id={message.id}
      data-assistant-content="true"
      data-agent-transcript-root="true"
    >
      {workFrames.map((frame) => {
        const segments = traceSegments(frame.segments);
        const items = groupAgentWorkItems(segments);
        if (items.length === 0) return null;
        const indexById = new Map(
          segments.map((segment, index) => [segment.id, index]),
        );

        return (
          <AgentTrace key={frame.id}>
            {items.map((item) => {
              if (item.kind === "narration") {
                return (
                  <AgentNarrationNote
                    key={item.segment.id}
                    segment={item.segment}
                  />
                );
              }

              const { group } = item;
              const searchUrls = groupSearchSourceUrls(group.segments);
              return (
                <AgentWorkGroupView
                  key={group.id}
                  group={group}
                  trailing={
                    searchUrls.length > 0 ? (
                      <AgentFaviconStack urls={searchUrls} />
                    ) : undefined
                  }
                >
                  {group.segments.map((segment) => {
                    if (isThinkingSegment(segment)) {
                      return (
                        <AgentThinkingPhase
                          key={segment.id}
                          segment={segment}
                        />
                      );
                    }
                    const path =
                      segment.filePath ??
                      (typeof segment.args?.path === "string"
                        ? segment.args.path
                        : "");
                    const prior =
                      segment.name === "create_file" ||
                      segment.name === "file_write"
                        ? previousFileContent(
                            segments,
                            indexById.get(segment.id) ?? 0,
                            path,
                          )
                        : undefined;
                    return (
                      <div
                        key={segment.id}
                        className="min-w-0"
                        data-agent-tool-group={segment.name}
                      >
                        <AgentToolBlock
                          tool={segment}
                          previousFileContent={prior}
                        />
                      </div>
                    );
                  })}
                </AgentWorkGroupView>
              );
            })}
          </AgentTrace>
        );
      })}

      {answer && !suppressDuplicateAnswer ? (
        <div
          data-agent-block="answer"
          className="animate-in fade-in slide-in-from-bottom-1 duration-200"
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
        <div data-agent-block="sources">
          <SourcesInlineStrip sources={sources} compact={streaming} />
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
