"use client";

import { useMemo } from "react";
import type { Message } from "@/lib/types";
import {
  agentTraceIsActive,
  type AgentNarrationStep,
  type AgentStep,
} from "@/lib/agent-trace";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { collectMessageSources } from "@/lib/chat-sources";
import {
  isAssistantGenerationError,
  toUserFacingChatError,
} from "@/lib/assistant-generation-error";
import { AgentTraceView, AgentWorkingRow } from "./agent-trace-view";

const EMPTY_AGENT_STEPS: AgentStep[] = [];

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
  const steps = trace?.steps ?? EMPTY_AGENT_STEPS;
  const answer = message.content.trim();
  const active = chatIsGenerating && trace?.complete !== true;
  const sources = collectMessageSources(message);
  const streaming = message.isStreaming === true && chatIsGenerating;

  const mirroredNarrationId = useMemo(
    () =>
      [...steps]
        .reverse()
        .find(
          (step) =>
            step.kind === "narration" &&
            answer.length > 0 &&
            step.content.trim() === answer,
        )?.id,
    [answer, steps],
  );
  const traceSteps = useMemo(
    () => steps.filter((step) => step.id !== mirroredNarrationId),
    [mirroredNarrationId, steps],
  );
  const hasTranscript = traceSteps.length > 0;
  const awaitingInput = steps.some(
    (step) =>
      step.kind === "tool" &&
      step.name === "ask_user_input_v0" &&
      step.status === "done" &&
      !answer,
  );

  if (!hasTranscript && !answer) {
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
      {hasTranscript ? (
        <AgentTraceView
          steps={traceSteps}
          isActive={
            active &&
            !answer &&
            agentTraceIsActive({
              steps: traceSteps,
              complete: trace?.complete,
            })
          }
          startedAtMs={trace?.startedAtMs}
          completedAtMs={trace?.completedAtMs}
          keepExpanded={awaitingInput}
          renderNarration={(step: AgentNarrationStep) => (
            <div
              className="agent-answer-body agent-intermediate-narration agent-narration"
              data-agent-intermediate-narration="true"
            >
              <AssistantContentRenderer
                content={step.content}
                messageId={message.id}
                isStreaming={active && step.isStreaming === true}
                streamKey={`${message.id}-narration-${step.id}`}
                detailLevel={detailLevel}
                {...({ sources } as any)}
              />
            </div>
          )}
        />
      ) : null}

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
              streamKey={`${message.id}-narration-${mirroredNarrationId ?? "answer"}`}
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
      <AgentWorkingRow />
    </div>
  );
}
