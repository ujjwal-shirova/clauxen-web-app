"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResearchSidebar } from "./research-sidebar";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  X,
} from "@/components/ui/bootstrap-icon";
import { apiFetch, ApiError } from "@/lib/api/client";
import { researchCountdown, type ResearchState } from "@/lib/research-state";
import { type DeepResearchPlan } from "@/lib/deep-research";
import { useActiveChatId } from "@/stores/chat-store";
import { hydrateMessageFromContentJson } from "@/lib/hydrate-chat-messages";
import type { Message } from "@/lib/types";
import { ResearchPlanLoading } from "./research-plan-loading";
import { ResearchReportCard } from "./research-report-card";
import { AgentTraceView } from "./agent/agent-trace-view";
import { AssistantContentRenderer } from "./assistant-content-renderer";

export function DurableResearchPlanCard({
  plan,
  planId,
  preparing,
  legacy = false,
}: {
  plan: DeepResearchPlan;
  planId: string;
  preparing: boolean;
  legacy?: boolean;
}) {
  const chatId = useActiveChatId();
  const [reportReady, setReportReady] = useState(false);
  const [state, setState] = useState<ResearchState | null>(null);
  const [now, setNow] = useState(Date.now);
  const [editing, setEditing] = useState(false);
  const [tasks, setTasks] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const actionLock = useRef(false);
  const actionVersion = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activity, setActivity] = useState<Message | null>(null);
  const path = chatId
    ? `/api/v1/chats/${encodeURIComponent(chatId)}/research/${encodeURIComponent(planId)}`
    : null;
  useEffect(() => {
    if (!path || preparing) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let terminal = false;
      const version = actionVersion.current;
      try {
        const result = await apiFetch<{
          plan: ResearchState;
          reportReady?: boolean;
          activity?: {
            id: string;
            content: string;
            contentJson: unknown;
          } | null;
        }>(`${path}${activityOpen ? "?activity=1" : ""}`, {
          signal: controller.signal,
          timeoutMs: 15000,
        });
        if (controller.signal.aborted || version !== actionVersion.current)
          return;
        setState(result.plan);
        setReportReady(result.reportReady === true);
        terminal =
          ["failed", "cancelled"].includes(result.plan.status) ||
          (result.plan.status === "complete" && result.reportReady === true);
        if (result.activity)
          setActivity(
            hydrateMessageFromContentJson(
              {
                id: result.activity.id,
                role: "assistant",
                content: result.activity.content,
                createdAt: Date.now(),
                agentMode: true,
              },
              result.activity.contentJson,
            ),
          );
        setError("");
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && [401, 403].includes(e.status)) {
          setError(e.message);
          terminal = true;
        } else if (!(e instanceof ApiError && e.status === 404))
          setError("Could not refresh research progress. Retrying…");
      } finally {
        if (!controller.signal.aborted && !terminal)
          timer = setTimeout(poll, 2500);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, chatId, activityOpen, preparing, refreshKey]);
  useEffect(() => {
    if (state?.status !== "pending") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state?.status]);
  const action = useCallback(
    async (action: string, updates?: { tasks: string[]; title: string }) => {
      if (!path || actionLock.current) return false;
      actionLock.current = true;
      actionVersion.current++;
      setPending(true);
      setError("");
      try {
        const result = await apiFetch<{ plan: ResearchState }>(path, {
          method: "POST",
          body: JSON.stringify({ action, ...updates }),
        });
        setState(result.plan);
        setRefreshKey((value) => value + 1);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update research.");
        return false;
      } finally {
        actionLock.current = false;
        setPending(false);
      }
    },
    [path],
  );
  const status = state?.status;
  const preparingCard = preparing || (!state && !legacy);
  const running = status === "running" || status === "starting";
  const done = status === "complete";
  const visibleTasks = editing ? tasks : (state?.tasks ?? plan.tasks);
  const visibleTitle = editing ? title : (state?.title ?? plan.title);
  const countdown = researchCountdown(state?.auto_start_at ?? null, now);
  const completed =
    state?.task_statuses.filter((s) => s === "complete").length ?? 0;
  const percent = done
    ? 100
    : Math.round((completed / Math.max(1, visibleTasks.length)) * 100);
  const button =
    "research-button no-hover-overlay h-8 rounded-full border border-[var(--ui-border-subtle)] px-3 text-[13px] disabled:opacity-40";
  if (preparingCard && !error) return <ResearchPlanLoading />;
  if (status === "complete" && state && path)
    return <ResearchReportCard path={path} state={state} ready={reportReady} />;
  if (status === "cancelled")
    return (
      <p
        data-deep-research-plan
        className="my-3 text-[13px] text-[var(--ui-fg-muted)]"
      >
        Deep Research cancelled.
      </p>
    );
  return (
    <div data-deep-research-plan className="my-3 min-w-0 w-full">
      <section
        aria-label="Deep research plan"
        aria-busy={preparingCard}
        className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)] p-4"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          {editing ? (
            <input
              aria-label="Research title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-[var(--ui-border)] bg-transparent px-2 py-1 text-[15px]"
            />
          ) : (
            <h3
              data-shimmer-active={preparingCard}
              className={`min-w-0 break-words text-[15px] font-medium leading-6 ${preparingCard ? "shimmer-text" : ""}`}
            >
              {visibleTitle}
            </h3>
          )}
          {status === "paused" ? (
            <button
              className={button}
              disabled={pending}
              onClick={() => void action("resume")}
            >
              Resume
            </button>
          ) : null}
        </div>
        <ol className="flex flex-col gap-3.5">
          {visibleTasks.map((task, index) => {
            const phase = state?.task_statuses[index] ?? "pending";
            return (
              <li
                key={index}
                className="flex min-w-0 items-start gap-3 text-[14px] leading-[22px]"
              >
                {phase === "complete" ? (
                  <Check
                    aria-label="Task complete"
                    className="mt-1 h-4 w-4 shrink-0 text-green-600"
                  />
                ) : phase === "running" && running ? (
                  <LoaderCircle
                    aria-label="Task in progress"
                    className="mt-1 h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-[var(--ui-border)]"
                  />
                )}
                {editing ? (
                  <textarea
                    aria-label={`Research task ${index + 1}`}
                    rows={2}
                    maxLength={1000}
                    value={task}
                    onChange={(e) =>
                      setTasks((old) =>
                        old.map((value, i) =>
                          i === index ? e.target.value : value,
                        ),
                      )
                    }
                    className="min-w-0 flex-1 resize-y rounded-md border border-[var(--ui-border)] bg-transparent px-2 py-1"
                  />
                ) : (
                  <span
                    data-shimmer-active={preparingCard}
                    className={`min-w-0 break-words ${preparingCard ? "shimmer-text" : ""}`}
                  >
                    {task}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {!state || status === "pending" || status === "editing" ? (
          <div className="mt-5 flex items-center gap-2">
            <button
              className={button}
              disabled={pending || preparingCard}
              onClick={async () => {
                if (editing) {
                  if (await action("update", { tasks, title }))
                    setEditing(false);
                } else if (await action("edit")) {
                  setTasks(state?.tasks ?? plan.tasks);
                  setTitle(state?.title ?? plan.title);
                  setEditing(true);
                }
              }}
            >
              {editing ? "Update" : "Edit"}
            </button>
            <div className="flex-1" />
            <button
              className={button}
              disabled={pending || preparingCard}
              onClick={() => void action("cancel")}
            >
              Cancel
            </button>
            <button
              disabled={pending || preparingCard || editing}
              onClick={() => void action("start")}
              className="app-btn app-btn-primary no-hover-overlay research-start flex h-8 items-center gap-2 rounded-full px-3 text-[13px] disabled:opacity-40"
            >
              Start
              {status === "pending" ? (
                <span
                  aria-label={`Auto-starts in ${countdown} seconds`}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px]"
                >
                  {countdown}
                </span>
              ) : null}
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-[13px] text-[var(--ui-fg-muted)]">
              <button
                onClick={() => setActivityOpen(true)}
                className="min-w-0 text-left hover:text-[var(--ui-fg)]"
                aria-label="Open research activity"
              >
                <span
                  data-shimmer-active={running}
                  className={running ? "shimmer-text" : ""}
                >
                  {running
                    ? "Researching…"
                    : done
                      ? "Research complete"
                      : status === "paused"
                        ? "Research paused"
                        : "Research failed"}
                </span>
              </button>
              <span title={`${state?.search_count ?? 0} search calls`}>
                {state?.source_count ?? 0} sources
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div
                role="progressbar"
                aria-label="Completed research tasks"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--ui-hover-wash)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--ui-fg)] transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {running ? (
                <button
                  aria-label="Pause research"
                  disabled={pending}
                  onClick={() => void action("pause")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ui-hover-wash)]"
                >
                  <Pause className="h-3.5 w-3.5" />
                </button>
              ) : status === "paused" ? (
                <button
                  aria-label="Resume research"
                  disabled={pending}
                  onClick={() => void action("resume")}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ui-hover-wash)]"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {status === "failed" ? (
              <button
                className={`${button} mt-3`}
                disabled={pending}
                onClick={() => void action("retry")}
              >
                Retry research
              </button>
            ) : null}
            {status === "paused" ? (
              <button
                disabled={pending}
                onClick={() => void action("cancel")}
                className="mt-3 text-[12px] text-[var(--ui-fg-muted)] underline"
              >
                Cancel research
              </button>
            ) : null}
          </div>
        )}
      </section>
      {error || state?.error ? (
        <p
          role="alert"
          className="mt-2 text-[12px] text-[var(--settings-danger)]"
        >
          {error || state?.error}
        </p>
      ) : null}
      {running ? (
        <p className="mt-2 flex items-center gap-2 text-[13px] leading-6">
          <Check className="h-4 w-4 text-green-600" />
          <span>
            <strong className="font-semibold">Deep Research has started</strong>{" "}
            on {state?.title}.
          </span>
        </p>
      ) : null}
      <ResearchSidebar
        open={activityOpen}
        onOpenChange={setActivityOpen}
        expanded={expanded}
      >
        <div className="flex items-start gap-2 border-b border-[var(--ui-border-subtle)] p-4">
          <Dialog.Title className="min-w-0 flex-1 text-[15px] font-medium leading-6">
            {state?.title ?? plan.title}
          </Dialog.Title>
          <button
            aria-label={
              expanded
                ? "Collapse research activity"
                : "Expand research activity"
            }
            onClick={() => setExpanded(!expanded)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-[var(--ui-hover-wash)]"
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <Dialog.Close
            aria-label="Close research activity"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-[var(--ui-hover-wash)]"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <h4 className="mb-4 text-[13px] font-medium text-[var(--ui-fg-muted)]">
            Research Activity
          </h4>
          {activity?.agentTrace?.steps.length ? (
            <AgentTraceView
              steps={activity.agentTrace.steps}
              isActive={running}
              isWorking={running}
              keepExpanded
              startedAtMs={activity.agentTrace.startedAtMs}
              completedAtMs={activity.agentTrace.completedAtMs}
              renderNarration={(step) => (
                <AssistantContentRenderer
                  content={step.content}
                  messageId={activity.id}
                  isStreaming={running && step.isStreaming === true}
                  streamKey={`${activity.id}-${step.id}`}
                  detailLevel="full"
                />
              )}
            />
          ) : (
            <p className="text-[13px] text-[var(--ui-fg-muted)]">
              {running
                ? "Waiting for the first research activity…"
                : "Research activity will appear here."}
            </p>
          )}
        </div>
      </ResearchSidebar>
    </div>
  );
}
