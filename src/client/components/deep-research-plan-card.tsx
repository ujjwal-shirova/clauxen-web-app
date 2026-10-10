"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useFollowUpPrompt } from "@/contexts/follow-up-prompt-context";
import {
  useActiveChatId,
  useActiveChatMessages,
  useChatStore,
} from "@/stores/chat-store";
import { isAssistantGenerationError } from "@/lib/assistant-generation-error";
import {
  approvedResearchTasks,
  researchActionPrefix,
  type DeepResearchPlan,
} from "@/lib/deep-research";

export function DeepResearchPlanCard({
  plan,
  planId,
  isStreaming,
}: {
  plan: DeepResearchPlan;
  planId: string;
  isStreaming: boolean;
}) {
  const { onSelect } = useFollowUpPrompt();
  const chatId = useActiveChatId();
  const messages = useActiveChatMessages();
  const busy = useChatStore((state) =>
    Boolean(chatId && state.generatingChatIds[chatId]),
  );
  const [editing, setEditing] = useState(false);
  const [tasks, setTasks] = useState(plan.tasks);
  const [countdown, setCountdown] = useState(30);
  const [submitted, setSubmitted] = useState(false);
  // Only a newly streamed plan auto-starts. Reading old history never starts work.
  const seenStreaming = useRef(isStreaming);
  useEffect(() => {
    if (isStreaming) seenStreaming.current = true;
  }, [isStreaming]);
  const sentRef = useRef(false);
  const startPrefix = researchActionPrefix("start", planId);
  const cancelPrefix = researchActionPrefix("cancel", planId);
  const actionIndex = messages.findIndex(
    (message) =>
      message.role === "user" &&
      (message.content.startsWith(startPrefix) ||
        message.content.startsWith(cancelPrefix)),
  );
  const action = actionIndex >= 0 ? messages[actionIndex] : undefined;
  const cancelled = action?.content.startsWith(cancelPrefix) === true;
  const researchReply =
    actionIndex >= 0
      ? messages
          .slice(actionIndex + 1)
          .find((message) => message.role === "assistant")
      : undefined;
  const failed = researchReply && isAssistantGenerationError(researchReply);
  const started =
    action?.content.startsWith(startPrefix) === true &&
    Boolean(researchReply) &&
    !failed;
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const current = latestAssistant?.id === planId;
  const canAct = Boolean(
    onSelect && current && !busy && !isStreaming && !action && !submitted,
  );

  const start = useCallback(() => {
    if (!canAct || sentRef.current || tasks.some((task) => !task.trim()))
      return;
    const state = useChatStore.getState();
    if (
      chatId &&
      (state.generatingChatIds[chatId] ||
        state
          .getMessagesForChat(chatId)
          .some(
            (message) =>
              message.content.startsWith(startPrefix) ||
              message.content.startsWith(cancelPrefix),
          ))
    )
      return;
    sentRef.current = true;
    setSubmitted(true);
    setEditing(false);
    onSelect?.(
      `${startPrefix}Start deep research: ${plan.title}\n\nApproved research plan:\n${tasks.map((task, index) => `${index + 1}. ${task.trim().replace(/\s+/g, " ")}`).join("\n")}\n\n${plan.summary}`,
    );
  }, [canAct, chatId, onSelect, startPrefix, cancelPrefix, plan, tasks]);

  useEffect(() => {
    if (!canAct || editing || !seenStreaming.current) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible")
        setCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [canAct, editing]);
  useEffect(() => {
    if (countdown === 0 && !editing) start();
  }, [countdown, editing, start]);

  const displayedTasks = action?.content.startsWith(startPrefix)
    ? (approvedResearchTasks(action.content) ?? tasks)
    : tasks;

  const buttonClass =
    "rounded-full border border-[var(--ui-border-subtle)] px-4 py-2 text-sm transition-colors hover:bg-[var(--ui-hover-wash)] disabled:cursor-default disabled:opacity-40";
  return (
    <div className="my-3 w-full" data-deep-research-plan>
      <section
        aria-label="Deep research plan"
        className="rounded-[22px] border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)] p-5 sm:p-6"
      >
        <h3 className="mb-5 text-[18px] font-medium leading-7">{plan.title}</h3>
        <ol className="flex flex-col gap-5">
          {displayedTasks.map((task, index) => (
            <li
              key={index}
              className="flex items-start gap-4 text-[16px] leading-6"
            >
              <span
                aria-hidden
                className="mt-1 h-[18px] w-[18px] shrink-0 rounded-full border-2 border-dashed border-[var(--ui-border)]"
              />
              {editing ? (
                <textarea
                  aria-label={`Research task ${index + 1}`}
                  value={task}
                  maxLength={1000}
                  rows={2}
                  onChange={(event) =>
                    setTasks((previous) =>
                      previous.map((value, taskIndex) =>
                        taskIndex === index ? event.target.value : value,
                      ),
                    )
                  }
                  className="min-w-0 flex-1 resize-y rounded-lg border border-[var(--ui-border)] bg-transparent px-2 py-1 outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                />
              ) : (
                <span>{task}</span>
              )}
            </li>
          ))}
        </ol>
        {!started && !cancelled && !action ? (
          <div className="mt-7 flex items-center gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={!canAct}
              onClick={() => {
                setEditing((value) => !value);
                setCountdown(30);
              }}
            >
              {editing ? "Done" : "Edit"}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              className={buttonClass}
              disabled={!canAct}
              onClick={() => {
                if (sentRef.current) return;
                sentRef.current = true;
                setSubmitted(true);
                onSelect?.(`${cancelPrefix}Cancel this deep research plan.`);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canAct || tasks.some((task) => !task.trim())}
              onClick={start}
              className="flex items-center gap-3 rounded-full bg-[var(--ui-fg)] px-4 py-2 text-sm text-[var(--app-panel-bg)] disabled:opacity-40"
            >
              {submitted ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                "Start"
              )}
              {canAct && !editing && seenStreaming.current ? (
                <span
                  aria-label={`Starts in ${countdown} seconds`}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs"
                >
                  {countdown}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}
      </section>
      <div aria-live="polite" className="mt-3">
        {started ? (
          <p className="flex items-center gap-2 text-[16px] font-semibold">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Deep Research has started.
          </p>
        ) : cancelled ? (
          <p className="text-sm text-[var(--ui-fg-muted)]">
            Deep Research cancelled.
          </p>
        ) : failed ? (
          <p role="alert" className="text-sm text-[var(--settings-danger)]">
            Research could not start. Retry the research message below.
          </p>
        ) : submitted ? (
          <p className="text-sm text-[var(--ui-fg-muted)]">
            Submitting research…
          </p>
        ) : null}
      </div>
      {plan.summary ? (
        <p className="mt-5 text-[16px] leading-7">{plan.summary}</p>
      ) : null}
    </div>
  );
}
