"use client";

import type { Message } from "@/frontend/lib/types";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import { resolveOrchestrationBlocks } from "@/frontend/lib/agent-frames";
import { AssistantContentRenderer } from "@/frontend/components/assistant-content-renderer";
import { StreamingOrbCursor } from "@/frontend/components/ui/streaming-orb-cursor";
import { collectMessageSources } from "@/frontend/lib/chat-sources";
import { shouldShowAssistantStreamingOrb } from "@/frontend/lib/streaming-orb-policy";
import { cn } from "@/frontend/lib/utils";
import { AgentWorkFrame } from "./agent-work-frame";
import { ArtifactFileCard } from "./artifact-file-card";

/**
 * Anthropic-style agent orchestration:
 * chronological transcript (thinking / tools / narration) then final answer.
 * Intro whispers and mid-turn text use serif narration; thinking stays sans.
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
      className="flex w-full min-w-0 flex-col gap-3"
      data-message-id={message.id}
      data-assistant-content="true"
      data-agent-transcript-root="true"
    >
      {blocks.map((block) => {
        if (block.kind === "timeline") {
          return (
            <AgentWorkFrame
              key={block.frame.id}
              segments={block.frame.segments}
              isStreaming={block.isActive}
              frameComplete={block.frame.complete}
              startedAtMs={block.frame.startedAtMs}
              completedAtMs={block.frame.completedAtMs}
            />
          );
        }

        const isIntro = block.blockId.endsWith("-intro");
        const isInterim = block.blockId.endsWith("-interim");
        const isAnswer = block.blockId.endsWith("-answer");
        const isNarrationVoice = isIntro || isInterim || isAnswer;

        return (
          <div
            key={block.blockId}
            className={cn(
              isNarrationVoice &&
                "font-serif text-[16.5px] leading-[1.65] tracking-[-0.01em] text-zinc-900",
              isIntro && "text-zinc-800",
              isInterim && "text-zinc-700",
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
