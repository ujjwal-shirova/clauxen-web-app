"use client";

import { useMemo } from "react";
import type { Message } from "@/lib/types";
import { agentTraceIsActive, traceHasWork } from "@/lib/agent-trace";
import { summarizeTraceSteps } from "@/lib/agent-trace-labels";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { collectMessageSources } from "@/lib/chat-sources";
import {
  isAssistantGenerationError,
  toUserFacingChatError,
} from "@/lib/assistant-generation-error";
import { AgentTraceView, AgentWorkingRow } from "./agent-trace-view";

/**
 * Agent transcript — the new flat trace view.
 *
 * Layout (top to bottom):
 *   1. Aggregate summary of finished work ("Ran 2 searches, ran 1 command")
 *      once the turn is done — collapsed ledger line.
 *   2. The ordered step trace (tools + narration prose).
 *   3. The trailing shimmering "Working for Ns" row while live.
 *   4. The final answer body below.
 */
export function AgentTranscriptView({
  message,
  detailLevel,
  chatIsGenerating = false,
}: {
  message: Message;
  detailLevel: MessageDetailLevel;
  chatIsGenerating?: boolean;
}) {
  const trace = message.agentTrace;
  const steps = useMemo(() => trace?.steps ?? [], [trace]);
  const active = agentTraceIsActive(trace) && chatIsGenerating;
  const answer = message.content.trim();
  const sources = collectMessageSources(message);
  const streaming = message.isStreaming === true && chatIsGenerating;

  const workSteps = useMemo(
    () => steps.filter((step) => traceHasWork([step])),
    [steps],
  );
  const hasWork = workSteps.length > 0;

  const summary = useMemo(
    () => (!active ? summarizeTraceSteps(steps) : null),
    [steps, active],
  );

  if (!hasWork && !answer) {
    if (!streaming) return null;
    return <FreshTurnPlaceholder />;
  }

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-3"
      data-message-id={message.id}
      data-assistant-content="true"
      data-agent-transcript-root="true"
    >
      {/* Done-state aggregate: one quiet ledger line above the trace. */}
      {!active && hasWork && steps.length > 3 && summary ? (
        <p
          className="min-w-0 truncate text-[13px] font-[430] leading-5 text-zinc-400 dark:text-zinc-500"
          data-agent-trace-summary="true"
        >
          {summary}
        </p>
      ) : null}

      <AgentTraceView
        steps={workSteps}
        isActive={active}
        startedAtMs={trace?.startedAtMs}
        hideFinalNarration={Boolean(answer)}
      />

      {answer ? (
        <div
          data-agent-block="answer"
          className="agent-answer-body"
          data-assistant-final-answer="true"
        >
          {isAssistantGenerationError(message) ? (
            <p
              data-assistant-error="true"
              className="min-w-0 text-[15px] font-[430] leading-[1.55] text-red-600"
              role="alert"
            >
              {toUserFacingChatError(message.content)}
            </p>
          ) : (
            <AssistantContentRenderer
              content={message.content}
              messageId={message.id}
              isStreaming={streaming}
              streamKey={`${message.id}-answer`}
              detailLevel={detailLevel}
              agentArtifacts={message.agentArtifacts}
              {...({ sources } as any)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function FreshTurnPlaceholder() {
  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1.5"
      data-agent-fresh-turn="true"
    >
      <AgentWorkingRow startedAtMs={Date.now()} />
    </div>
  );
}
