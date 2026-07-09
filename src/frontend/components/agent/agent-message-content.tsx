"use client";

import type { Message } from "@/frontend/lib/types";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { AssistantContentRenderer } from "@/frontend/components/assistant-content-renderer";
import { ThinkingBlock } from "@/frontend/components/thinking-block";
import { StreamingOrbCursor } from "@/frontend/components/ui/streaming-orb-cursor";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import {
  resolveOrchestrationBlocks,
  shouldUseAgentMessageLayout,
} from "@/frontend/lib/agent-frames";
import { AgentOrchestrationView } from "./agent-orchestration";
import { collectMessageSources } from "@/frontend/lib/chat-sources";

export function AgentMessageContent({
  message,
  detailLevel,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
}) {
  const blocks = resolveOrchestrationBlocks(message);
  const hasAgentUi = shouldUseAgentMessageLayout(message);

  const showOrb =
    message.isStreaming === true &&
    message.content.length === 0 &&
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
            thinkingStartedAtMs={message.thinkingStartedAtMs}
            className="mb-4"
          />
        )}
        {showOrb ? (
          <div className="flex items-center py-1">
            <StreamingOrbCursor />
          </div>
        ) : null}
        {message.content.length > 0 ? (
          <div data-message-id={message.id} data-assistant-content="true" className="min-w-0">
            <AssistantContentRenderer
              content={message.content}
              messageId={message.id}
              isStreaming={!!message.isStreaming}
              streamKey={message.id}
              detailLevel={detailLevel}
              agentArtifacts={message.agentArtifacts}
              {...({ sources: collectMessageSources(message) } as any)}
            />
          </div>
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
