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
import { ThinkingBlock } from "@/components/thinking-block";
import { AgentTraceView } from "./agent-trace-view";
import { AgentWorkCursor } from "./agent-work-cursor";

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

  const hasLegacyThinking =
    !traceSteps.some((step) => step.kind === "thinking") &&
    (message.hasThinking || (message.thinkingContent?.trim().length ?? 0) > 0);

  const hasTurnClock =
    typeof (trace?.startedAtMs ?? message.createdAt) === "number";
  if (!hasTranscript && !hasLegacyThinking && !answer && !streaming && !trace) return null;

  const stableMessageKey = messageUiKey(message);
  const isWorking = streaming && active && !awaitingInput;
  const showTrace =
    hasTranscript &&
    (isWorking ||
      trace?.complete === true ||
      activitySteps.length > 0 ||
      narrationSteps.length > 0 ||
      hasTurnClock);
  // The work cursor stays pinned at the bottom of the turn through the whole
  // run — including while the final answer streams — like an output cursor.
  const showWorkCursor = streaming || isWorking;

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

      {hasLegacyThinking ? (
        <ThinkingBlock
          content={message.thinkingContent}
          isStreaming={!!message.isThinkingStreaming && chatIsGenerating}
          thinkingDurationSeconds={message.thinkingDurationSeconds}
          thinkingStartedAtMs={message.thinkingStartedAtMs}
          className="mb-4"
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

      {showWorkCursor ? <AgentWorkCursor /> : null}
    </div>
  );
}
