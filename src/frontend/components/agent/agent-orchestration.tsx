"use client";

import type { Message } from "@/frontend/lib/types";
import type { MessageDetailLevel } from "@/frontend/hooks/use-message-visibility";
import { resolveOrchestrationBlocks } from "@/frontend/lib/agent-frames";
import { MarkdownRenderer } from "@/frontend/components/markdown-renderer";
import { OrbCursor } from "@/frontend/components/ui/orb-cursor";
import { AgentWorkFrame } from "./agent-work-frame";

export function AgentOrchestrationView({
  message,
  detailLevel,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
}) {
  const blocks = resolveOrchestrationBlocks(message);
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
        <OrbCursor />
      </div>
    ) : null;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {showOrb ? (
        <div className="flex items-center py-1">
          <OrbCursor />
        </div>
      ) : null}

      {blocks.map((block) => {
        if (block.kind === "timeline") {
          return (
            <AgentWorkFrame
              key={block.frame.id}
              segments={block.frame.segments}
              isStreaming={block.isActive}
            />
          );
        }

        return (
          <MarkdownRenderer
            key={block.blockId}
            content={block.content}
            isStreaming={block.isStreaming}
            streamKey={block.blockId}
            detailLevel={detailLevel}
          />
        );
      })}
    </div>
  );
}
