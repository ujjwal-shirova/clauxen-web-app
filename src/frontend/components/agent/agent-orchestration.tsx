"use client";

import type { Message } from "@/frontend/lib/types";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import { resolveOrchestrationBlocks } from "@/frontend/lib/agent-frames";
import { AssistantContentRenderer } from "@/frontend/components/assistant-content-renderer";
import { StreamingOrbCursor } from "@/frontend/components/ui/streaming-orb-cursor";
import { collectMessageSources } from "@/frontend/lib/chat-sources";
import { shouldShowAssistantStreamingOrb } from "@/frontend/lib/streaming-orb-policy";
import { cn } from "@/frontend/lib/utils";
import { AgentTrace } from "./agent-trace";
import { AgentThinkingPhase } from "./agent-thinking-phase";
import { AgentNarrationNote } from "./agent-narration-note";
import { AgentToolBlock } from "./agent-tool-blocks";
import { ArtifactFileCard } from "./artifact-file-card";
import type {
  AgentNarrationSegment,
  AgentSegment,
  AgentTextSegment,
  AgentThinkingSegment,
  AgentToolSegment,
} from "@/frontend/lib/agent-segments";

function isThinkingSegment(
  segment: AgentSegment,
): segment is AgentThinkingSegment {
  return segment.kind === "thinking";
}

function isToolSegment(segment: AgentSegment): segment is AgentToolSegment {
  return segment.kind === "tool";
}

function isNarrationSegment(
  segment: AgentSegment,
): segment is AgentNarrationSegment | AgentTextSegment {
  return segment.kind === "narration" || segment.kind === "text";
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

/**
 * Clauxen agent transcript — a single chronological trace of interleaved
 * thinking, narration, and tool execution, followed by the ordinary
 * final-answer markdown.
 *
 * The trace preserves the model's emit order (interleaved-thinking safe):
 * thinking → narration → tool → thinking → tool → … → final answer.
 * Each segment kind owns its own minimal visual treatment.
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
          return (
            <AgentTrace key={block.frame.id}>
              {segments.map((segment) => {
                if (isThinkingSegment(segment)) {
                  return (
                    <AgentThinkingPhase key={segment.id} segment={segment} />
                  );
                }
                if (isNarrationSegment(segment)) {
                  return (
                    <AgentNarrationNote key={segment.id} segment={segment} />
                  );
                }
                if (isToolSegment(segment)) {
                  return (
                    <div
                      key={segment.id}
                      className="min-w-0"
                      data-agent-tool-group={segment.name}
                    >
                      <AgentToolBlock tool={segment} />
                    </div>
                  );
                }
                return null;
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

      {message.agentArtifacts && message.agentArtifacts.length > 0 ? (
        <div className="flex w-full flex-col gap-2">
          {message.agentArtifacts.map((artifact) => (
            <ArtifactFileCard key={artifact.id} artifact={artifact} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
