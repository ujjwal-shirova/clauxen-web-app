"use client";

import { useMemo } from "react";
import type { Message } from "@/lib/types";
import {
  type AgentNarrationStep,
  type AgentStep,
} from "@/lib/agent-trace";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { collectMessageSources } from "@/lib/chat-sources";
import { messageUiKey } from "@/lib/message-ui-key";
import {
  isAssistantGenerationError,
  toUserFacingChatError,
} from "@/lib/assistant-generation-error";
import { AgentTraceView } from "./agent-trace-view";

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
  const narrationSteps = useMemo(
    () =>
      traceSteps.filter(
        (step): step is AgentNarrationStep =>
          step.kind === "narration" && step.content.trim().length > 0,
      ),
    [traceSteps],
  );
  const activitySteps = useMemo(
    () => traceSteps.filter((step) => step.kind !== "narration"),
    [traceSteps],
  );
  const hasTranscript = activitySteps.length > 0 || narrationSteps.length > 0;
  const awaitingInput = steps.some(
    (step) =>
      step.kind === "tool" &&
      step.name === "ask_user_input_v0" &&
      step.status === "done" &&
      !answer,
  );

  const hasTurnClock =
    typeof (trace?.startedAtMs ?? message.createdAt) === "number";
  if (!hasTranscript && !answer && !streaming && !trace) return null;

  const stableMessageKey = messageUiKey(message);
  const isWorking = streaming && active && !awaitingInput;
  const showTrace =
    hasTranscript ||
    isWorking ||
    (trace?.complete === true && hasTurnClock);

  const renderNarration = (step: AgentNarrationStep) => (
    <div
      className="agent-answer-body agent-intermediate-narration agent-narration"
      data-agent-intermediate-narration="true"
    >
      <AssistantContentRenderer
        content={step.content}
        messageId={message.id}
        isStreaming={active && step.isStreaming === true}
        streamKey={`${stableMessageKey}-narration-${step.id}`}
        detailLevel={detailLevel}
        {...({ sources } as any)}
      />
    </div>
  );

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-3"
      data-message-id={message.id}
      data-assistant-content="true"
      data-agent-transcript-root="true"
    >
      {showTrace ? (
        <AgentTraceView
          steps={traceSteps}
          renderNarration={renderNarration}
          isActive={isWorking && !answer}
          isWorking={isWorking}
          startedAtMs={trace?.startedAtMs ?? message.createdAt}
          completedAtMs={trace?.completedAtMs}
          keepExpanded={awaitingInput}
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
              streamKey={`${stableMessageKey}-narration-${mirroredNarrationId ?? "answer"}`}
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
