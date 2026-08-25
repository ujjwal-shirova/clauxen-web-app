"use client";

import type { Message } from "@/lib/types";
import { messageUiKey } from "@/lib/message-ui-key";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { ThinkingBlock } from "@/components/thinking-block";
import { StreamingOrbCursor } from "@/components/ui/streaming-orb-cursor";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import { agentTraceIsActive } from "@/lib/agent-trace";
import { shouldShowAssistantStreamingOrb } from "@/lib/streaming-orb-policy";
import { AgentTranscriptView } from "./agent-transcript";
import { AgentWorkingRow } from "./agent-trace-view";
import { collectMessageSources } from "@/lib/chat-sources";

/** Once an agent turn has a trace, keep that renderer mounted through settle.
 * Switching back to the plain answer renderer on finalize remounted markdown
 * and caused the transient large/bold first frame. */
export function shouldUseAgentTraceLayout(message: Message): boolean {
  return (
    Boolean(message.agentMode) && (message.agentTrace?.steps.length ?? 0) > 0
  );
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
  const answerStreaming = streaming && message.content.trim().length > 0;
  const showOrb = shouldShowAssistantStreamingOrb({
    isStreaming: streaming,
    answerStreaming,
    chatIsGenerating,
  });
  // Inline citation chips only — no auto bottom source-card strip.
  const sources = collectMessageSources(message);

  // Fresh turn before any tokens — shimmering Working-for row (agent mode)
  // or the plain orb (simple chats).
  if (streaming && !message.content.trim() && !hasThinking) {
    if (message.agentMode && !message.agentFrameComplete) {
      return (
        <AgentWorkingRow
          startedAtMs={message.agentTrace?.startedAtMs ?? message.createdAt}
        />
      );
    }
    return <StreamingOrbCursor />;
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

// Keep the activity predicate referenced for external callers.
export { agentTraceIsActive };
