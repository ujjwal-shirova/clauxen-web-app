"use client";

import type { Message } from "@/frontend/lib/types";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { ThinkingBlock } from "@/frontend/components/thinking-block";
import { OrbCursor } from "@/frontend/components/ui/orb-cursor";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import {
  resolveAgentFrames,
  resolveOrchestrationBlocks,
} from "@/frontend/lib/agent-frames";
import { AgentOrchestrationView } from "./agent-orchestration";

export function AgentMessageContent({
  message,
  detailLevel,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
}) {
  const frames = resolveAgentFrames(message);
  const blocks = resolveOrchestrationBlocks(message);
  const hasAgentUi =
    message.agentMode === true ||
    frames.length > 0 ||
    blocks.length > 0 ||
    (message.agentSegments?.length ?? 0) > 0;

  const showOrb =
    message.isStreaming === true &&
    message.content.trim().length === 0 &&
    blocks.length === 0;

  if (!hasAgentUi) {
    return (
      <>
        {(message.hasThinking ||
          (message.thinkingContent?.trim().length ?? 0) > 0) && (
          <ThinkingBlock
            content={message.thinkingContent}
            isStreaming={!!message.isThinkingStreaming}
            thinkingDurationSeconds={message.thinkingDurationSeconds}
            className="mb-4"
          />
        )}
        {showOrb ? (
          <div className="flex items-center py-1">
            <OrbCursor />
          </div>
        ) : null}
        {message.content.trim().length > 0 ? (
          <MarkdownRenderer
            content={message.content}
            isStreaming={!!message.isStreaming}
            streamKey={message.id}
            detailLevel={detailLevel}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="w-full min-w-0">
      <AgentOrchestrationView message={message} detailLevel={detailLevel} />
    </div>
  );
}
