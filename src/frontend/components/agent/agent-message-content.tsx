"use client";

import type { Message } from "@/frontend/lib/types";
import { AssistantContentRenderer } from "@/frontend/components/assistant-content-renderer";
import { ThinkingBlock } from "@/frontend/components/thinking-block";
import { StreamingOrbCursor } from "@/frontend/components/ui/streaming-orb-cursor";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import { shouldUseAgentMessageLayout } from "@/frontend/lib/agent-frames";
import { shouldShowAssistantStreamingOrb } from "@/frontend/lib/streaming-orb-policy";
import { AgentOrchestrationView } from "./agent-orchestration";
import { collectMessageSources } from "@/frontend/lib/chat-sources";

export function AgentMessageContent({
  message,
  detailLevel,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
}) {
  const hasAgentUi = shouldUseAgentMessageLayout(message);

  if (!hasAgentUi) {
    const answerStreaming =
      message.isStreaming === true && message.content.trim().length > 0;
    const showOrb = shouldShowAssistantStreamingOrb({
      isStreaming: message.isStreaming === true,
      answerStreaming,
    });

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
        {message.content.length > 0 ? (
          <div
            data-message-id={message.id}
            data-assistant-content="true"
            className="min-w-0"
          >
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
        {showOrb ? (
          <div className="flex items-center py-1" data-streaming-orb="bottom">
            <StreamingOrbCursor />
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
