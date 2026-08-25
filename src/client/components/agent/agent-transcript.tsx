"use client";

import { useMemo } from "react";
import type { Message } from "@/lib/types";
import type { AgentNarrationStep, AgentStep } from "@/lib/agent-trace";
import type { MessageDetailLevel } from "@/hooks/use-message-visibility";
import { AssistantContentRenderer } from "@/components/assistant-content-renderer";
import { collectMessageSources } from "@/lib/chat-sources";
import {
  isAssistantGenerationError,
  toUserFacingChatError,
} from "@/lib/assistant-generation-error";
import { AgentTraceView, AgentWorkingRow } from "./agent-trace-view";

/**
 * Tools/thinking form collapsible trace runs. Model-authored narration breaks
 * those runs and renders with the exact same markdown surface as an answer.
 */
type TranscriptSection =
  | { kind: "work"; id: string; steps: AgentStep[] }
  | { kind: "narration"; id: string; step: AgentNarrationStep };

const EMPTY_AGENT_STEPS: AgentStep[] = [];

function buildTranscriptSections(
  steps: AgentStep[],
  mirroredNarrationId?: string,
): TranscriptSection[] {
  const sections: TranscriptSection[] = [];
  let pendingWork: AgentStep[] = [];

  const flushWork = () => {
    if (pendingWork.length === 0) return;
    sections.push({
      kind: "work",
      id: `work-${pendingWork[0]?.id ?? sections.length}`,
      steps: pendingWork,
    });
    pendingWork = [];
  };

  for (const step of steps) {
    if (step.kind !== "narration") {
      pendingWork.push(step);
      continue;
    }
    flushWork();
    if (step.id !== mirroredNarrationId && step.content.trim()) {
      sections.push({ kind: "narration", id: step.id, step });
    }
  }
  flushWork();
  return sections;
}

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
  const sections = useMemo(
    () => buildTranscriptSections(steps, mirroredNarrationId),
    [mirroredNarrationId, steps],
  );
  const hasTranscript = sections.length > 0;
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
      {sections.map((section, index) => {
        const isLastSection = index === sections.length - 1;
        if (section.kind === "narration") {
          return (
            <div
              key={section.id}
              className="agent-answer-body agent-intermediate-narration agent-trace-enter"
              data-agent-intermediate-narration="true"
            >
              <AssistantContentRenderer
                content={section.step.content}
                messageId={message.id}
                isStreaming={active && section.step.isStreaming === true}
                streamKey={`${message.id}-narration-${section.id}`}
                detailLevel={detailLevel}
                {...({ sources } as any)}
              />
            </div>
          );
        }

        const startedAtMs =
          section.steps.find((step) => step.startedAtMs)?.startedAtMs ??
          trace?.startedAtMs;
        const nextSection = sections[index + 1];
        const completedAtMs =
          nextSection?.kind === "narration"
            ? nextSection.step.startedAtMs
            : section.steps.reduce(
                (latest, step) => Math.max(latest, step.completedAtMs ?? 0),
                0,
              ) || trace?.completedAtMs;

        return (
          <AgentTraceView
            key={section.id}
            steps={section.steps}
            isActive={active && !answer && isLastSection}
            startedAtMs={startedAtMs}
            completedAtMs={completedAtMs}
            keepExpanded={awaitingInput && isLastSection}
          />
        );
      })}

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
