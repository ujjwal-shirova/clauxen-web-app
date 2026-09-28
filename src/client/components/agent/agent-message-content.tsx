"use client";

import type { Message } from "@/lib/types";
import { messageUiKey } from "@/lib/message-ui-key";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { ThinkingBlock } from "@/components/thinking-block";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import { agentTraceIsActive } from "@/lib/agent-trace";
import { AgentTranscriptView } from "./agent-transcript";
import { AgentWorkingRow } from "./agent-trace-view";
import { collectMessageSources } from "@/lib/chat-sources";

/** Keep one agent renderer mounted from the optimistic Working frame through
 * trace steps and the final answer. Switching renderers at those boundaries
 * resets both the morph animation and streamed markdown presentation. */
export function shouldUseAgentTraceLayout(message: Message): boolean {
  return Boolean(message.agentMode);
}

export function AgentMessageContent({
  message,
  detailLevel,
  chatIsGenerating = false,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
  chatIsGenerating?: boolean;
}) {
  if (shouldUseAgentTraceLayout(message)) {
    return (
      <div className="w-full min-w-0">
        <AgentTranscriptView
          message={message}
          detailLevel={detailLevel}
          chatIsGenerating={chatIsGenerating}
        />
      </div>
    );
  }

  const streaming = message.isStreaming === true && chatIsGenerating;
  const hasThinking =
    message.hasThinking || (message.thinkingContent?.trim().length ?? 0) > 0;
  const sources = collectMessageSources(message);

  if (streaming && !message.content.trim() && !hasThinking) {
    if (message.agentMode && !message.agentFrameComplete) {
      return (
        <AgentWorkingRow
          startedAtMs={message.agentTrace?.startedAtMs ?? message.createdAt}
        />
      );
    }
    return null;
  }

  return (
    <>
      {hasThinking ? (
        <ThinkingBlock
          content={message.thinkingContent}
          isStreaming={!!message.isThinkingStreaming && chatIsGenerating}
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
    </>
  );
}

// Keep the activity predicate referenced for external callers.
export { agentTraceIsActive };
