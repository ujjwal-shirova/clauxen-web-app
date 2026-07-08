"use client";

import type { Message } from "@/frontend/lib/types";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import { resolveOrchestrationBlocks } from "@/frontend/lib/agent-frames";
import { AssistantContentRenderer } from "@/frontend/components/assistant-content-renderer";
import { TypingDots } from "@/frontend/components/ui/typing-dots";
import { collectMessageSources } from "@/frontend/lib/chat-sources";
import { AgentWorkFrame } from "./agent-work-frame";

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
  const hasVisibleOutput = blocks.some(
    (block) =>
      block.kind === "markdown" && block.content.trim().length > 0,
  );
  const hasActiveTimeline = blocks.some(
    (block) => block.kind === "timeline" && block.isActive,
  );
  const showOrb = streaming && !hasVisibleOutput && !hasActiveTimeline;

  if (blocks.length === 0) {
    return showOrb ? (
      <div className="flex items-center py-1">
        <TypingDots />
      </div>
    ) : null;
  }

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-3"
      data-message-id={message.id}
      data-assistant-content="true"
    >
      {blocks.map((block) => {
        if (block.kind === "timeline") {
          return (
            <AgentWorkFrame
              key={block.frame.id}
              segments={block.frame.segments}
              isStreaming={block.isActive}
              frameComplete={block.frame.complete}
            />
          );
        }

        return (
          <div
            key={block.blockId}
            className={
              block.blockId.endsWith("-interim")
                ? "text-[15px] font-semibold leading-relaxed text-zinc-900"
                : block.blockId.endsWith("-intro")
                  ? "text-[15px] leading-relaxed text-zinc-700"
                  : undefined
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
        <div className="flex items-center py-1">
          <TypingDots />
        </div>
      ) : null}
    </div>
  );
}
