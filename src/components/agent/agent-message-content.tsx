"use client";

import type { Message } from "@/lib/types";
import { messageUiKey } from "@/lib/message-ui-key";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { ThinkingBlock } from "@/components/thinking-block";
import { StreamingOrbCursor } from "@/components/ui/streaming-orb-cursor";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import { shouldUseAgentMessageLayout } from "@/lib/agent-frames";
import { shouldShowAssistantStreamingOrb } from "@/lib/streaming-orb-policy";
import { AgentOrchestrationView } from "./agent-orchestration";
import { collectMessageSources } from "@/lib/chat-sources";

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
              streamKey={messageUiKey(message)}
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
