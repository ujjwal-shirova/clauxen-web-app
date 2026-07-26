"use client";

import type { Message } from "@/lib/types";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import { resolveOrchestrationBlocks } from "@/lib/agent-frames";
import { groupAgentTraceItems } from "@/lib/agent-fold-groups";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { StreamingOrbCursor } from "@/components/ui/streaming-orb-cursor";
import { collectMessageSources } from "@/lib/chat-sources";
import { shouldShowAssistantStreamingOrb } from "@/lib/streaming-orb-policy";
import { cn } from "@/lib/utils";
import { AgentTrace } from "./agent-trace";
import { AgentFoldGroup } from "./agent-fold-group";
import { AgentThinkingPhase } from "./agent-thinking-phase";
import { AgentNarrationNote } from "./agent-narration-note";
import { AgentToolBlock } from "./agent-tool-blocks";
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

function renderFoldMember(
  segment: AgentThinkingSegment | AgentToolSegment,
  allSegments: AgentSegment[],
  indexInAll: number,
) {
  if (isThinkingSegment(segment)) {
    return <AgentThinkingPhase key={segment.id} segment={segment} />;
  }
  if (isToolSegment(segment)) {
    const path =
      segment.filePath ??
      (typeof segment.args?.path === "string" ? segment.args.path : "");
    const prior =
      segment.name === "create_file" || segment.name === "file_write"
        ? previousFileContent(allSegments, indexInAll, path)
        : undefined;
    return (
      <div
        key={segment.id}
        className="min-w-0"
        data-agent-tool-group={segment.name}
      >
        <AgentToolBlock tool={segment} previousFileContent={prior} />
      </div>
    );
  }
  return null;
}

/**
 * Clauxen agent transcript — fold groups for thinking+tools (Explored N…),
 * narration between folds, then ordinary final-answer markdown.
 */
export function AgentOrchestrationView({
  message,
  detailLevel,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
}) {
  const blocks = resolveOrchestrationBlocks(message);
  const sources = collectMessageSources(message);
  const streaming = message.isStreaming === true;
  const answerStreaming = blocks.some(
    (block) =>
      block.kind === "markdown" &&
      block.isStreaming &&
      block.content.trim().length > 0,
  );
  const showOrb = shouldShowAssistantStreamingOrb({
    isStreaming: streaming,
    answerStreaming,
  });

  if (blocks.length === 0) {
    return showOrb ? (
      <div className="flex items-center py-1">
        <StreamingOrbCursor />
      </div>
    ) : null;
  }

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-3.5"
      data-message-id={message.id}
      data-assistant-content="true"
      data-agent-transcript-root="true"
    >
      {blocks.map((block) => {
        if (block.kind === "timeline") {
          const segments = traceSegments(block.frame.segments);
          if (segments.length === 0) return null;
          const items = groupAgentTraceItems(segments);
          const indexById = new Map(
            segments.map((segment, index) => [segment.id, index]),
          );

          return (
            <AgentTrace key={block.frame.id}>
              {items.map((item) => {
                if (item.kind === "narration") {
                  return (
                    <AgentNarrationNote
                      key={item.segment.id}
                      segment={item.segment}
                    />
                  );
                }

                return (
                  <AgentFoldGroup
                    key={item.id}
                    summary={item.summary}
                    isActive={item.isActive}
                    useChrome={item.useChrome}
                  >
                    {item.segments.map((segment) =>
                      renderFoldMember(
                        segment,
                        segments,
                        indexById.get(segment.id) ?? 0,
                      ),
                    )}
                  </AgentFoldGroup>
                );
              })}
            </AgentTrace>
          );
        }

        const isIntro = block.blockId.endsWith("-intro");
        const isInterim = block.blockId.endsWith("-interim");
        const isNarrationVoice = isIntro || isInterim;

        return (
          <div
            key={block.blockId}
            className={cn(
              isNarrationVoice &&
                "text-[14px] font-[430] leading-[1.55] tracking-[-0.01em] text-zinc-700",
            )}
            data-agent-block={
              isIntro ? "intro" : isInterim ? "interim" : "answer"
            }
          >
            <AssistantContentRenderer
              content={block.content}
              messageId={message.id}
              isStreaming={block.isStreaming}
              streamKey={block.blockId}
              detailLevel={detailLevel}
              agentArtifacts={message.agentArtifacts}
              {...({ sources } as any)}
            />
          </div>
        );
      })}

      {showOrb ? (
        <div className="flex items-center py-1" data-streaming-orb="bottom">
          <StreamingOrbCursor />
        </div>
      ) : null}
    </div>
  );
}
