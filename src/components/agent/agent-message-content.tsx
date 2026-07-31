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
import { AgentPlanningNextMoves } from "./agent-planning-label";
import { collectMessageSources } from "@/lib/chat-sources";
import { SourcesInlineStrip } from "@/components/chat-sources";
import { hasCompletedAssistantOutput } from "@/lib/assistant-output-state";

export function AgentMessageContent({
  message,
  detailLevel,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
}) {
  const hasAgentUi = shouldUseAgentMessageLayout(message);

  if (!hasAgentUi) {
    const streaming = message.isStreaming === true;
    const hasThinking =
      message.hasThinking ||
      (message.thinkingContent?.trim().length ?? 0) > 0;
    const answerStreaming = streaming && message.content.trim().length > 0;
    const showOrb = shouldShowAssistantStreamingOrb({
      isStreaming: streaming,
      answerStreaming,
    });
    const sources = collectMessageSources(message);
    const outputComplete = hasCompletedAssistantOutput(message);

    // Fresh turn before any tokens — orb only (no planning label).
    if (streaming && !message.content.trim() && !hasThinking) {
      return <AgentPlanningNextMoves showOrb={showOrb} />;
    }

    return (
      <>
        {hasThinking ? (
          <ThinkingBlock
            content={message.thinkingContent}
            isStreaming={!!message.isThinkingStreaming}
            thinkingDurationSeconds={message.thinkingDurationSeconds}
            thinkingStartedAtMs={message.thinkingStartedAtMs}
            className="mb-4"
          />
        ) : null}
        {message.content.length > 0 ? (
          <div
            data-message-id={message.id}
            data-assistant-content="true"
            className="agent-answer-body min-w-0"
          >
            <AssistantContentRenderer
              content={message.content}
              messageId={message.id}
              isStreaming={streaming}
              streamKey={messageUiKey(message)}
              detailLevel={detailLevel}
              agentArtifacts={message.agentArtifacts}
              {...({ sources } as any)}
            />
          </div>
        ) : null}
        {sources.length > 0 && outputComplete ? (
          <div data-agent-block="sources" className="overflow-anchor-none">
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
      </>
    );
  }

  return (
    <div className="w-full min-w-0">
      <AgentOrchestrationView message={message} detailLevel={detailLevel} />
    </div>
  );
}
