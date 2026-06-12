"use client";

import type { Message } from "@/frontend/lib/types";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { ThinkingBlock } from "@/frontend/components/thinking-block";
import { OrbCursor } from "@/frontend/components/ui/orb-cursor";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import { AgentWorkFrame } from "./agent-work-frame";

export function AgentMessageContent({
  message,
  detailLevel,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
}) {
  const segments = message.agentSegments ?? [];
  const frameComplete =
    message.agentFrameComplete === true || message.isStreaming === false;
  const hasWorkSegments = segments.some(
    (segment) => segment.kind === "thinking" || segment.kind === "tool",
  );
  const showFrame = hasWorkSegments;

  const hasActiveWork = segments.some(
    (segment) =>
      (segment.kind === "thinking" && segment.isStreaming) ||
      (segment.kind === "tool" && segment.status === "running"),
  );

  const showOrb =
    message.isStreaming === true &&
    !hasActiveWork &&
    !frameComplete &&
    message.content.trim().length === 0;

  const showFinalOutput =
    message.content.trim().length > 0 &&
    frameComplete &&
    (message.agentFrameComplete === true || message.isStreaming === false);

  if (!message.agentMode && segments.length === 0) {
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
      {showFrame ? (
        <AgentWorkFrame
          segments={segments}
          isStreaming={!!message.isStreaming}
          frameComplete={frameComplete}
        />
      ) : null}

      {showOrb ? (
        <div className="flex items-center py-1">
          <OrbCursor />
        </div>
      ) : null}

      {showFinalOutput ? (
        <MarkdownRenderer
          content={message.content}
          isStreaming={!!message.isStreaming && frameComplete}
          streamKey={message.id}
          detailLevel={detailLevel}
        />
      ) : null}
    </div>
  );
}
