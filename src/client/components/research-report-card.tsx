"use client";
import { useEffect, useState } from "react";
import { ResearchSidebar } from "./research-sidebar";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Download,
  FileText,
  Maximize2,
  Minimize2,
  X,
  Waypoints,
  Telescope,
  LoaderCircle,
} from "@/components/ui/bootstrap-icon";
import { apiFetch } from "@/lib/api/client";
import type { ResearchReport } from "@/lib/research-report";
import type { ResearchState } from "@/lib/research-state";
import { hydrateMessageFromContentJson } from "@/lib/hydrate-chat-messages";
import type { Message } from "@/lib/types";
import { MarkdownOrchestrator } from "./markdown-renderer";
import { AgentTraceView } from "./agent/agent-trace-view";
import { AssistantContentRenderer } from "./assistant-content-renderer";
import { exportResearchReport } from "../lib/research-export";
const iconButton =
  "research-icon-button no-hover-overlay flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40";
export function ResearchReportCard({
  path,
  state,
  ready,
}: {
  path: string;
  state: ResearchState;
  ready: boolean;
}) {
  const [report, setReport] = useState<ResearchReport | null>(null),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [expanded, setExpanded] = useState(false),
    [tab, setTab] = useState<"sources" | "activity" | null>(null),
    [activity, setActivity] = useState<Message | null>(null),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    apiFetch<{ report: ResearchReport }>(`${path}/report`, {
      signal: controller.signal,
    })
      .then((result) => {
        setReport(result.report);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not load the report.",
          );
      });
    return () => controller.abort();
  }, [path, ready, retry]);
  useEffect(() => {
    if (!open || tab !== "activity") return;
    const controller = new AbortController();
    apiFetch<{
      activity?: { id: string; content: string; contentJson: unknown } | null;
    }>(`${path}?activity=1`, { signal: controller.signal })
      .then(({ activity: turn }) => {
        if (turn)
          setActivity(
            hydrateMessageFromContentJson(
              {
                id: turn.id,
                role: "assistant",
                content: turn.content,
                createdAt: Date.now(),
                agentMode: true,
              },
              turn.contentJson,
            ),
          );
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Could not load research activity.",
          );
      });
    return () => controller.abort();
  }, [open, tab, path]);
  const save = async (format: "md" | "docx" | "pdf") => {
    if (!report || busy) return;
    setBusy(true);
    setError("");
    try {
      await exportResearchReport(report, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export the report.");
    } finally {
      setBusy(false);
    }
  };
  const downloadMenu = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={iconButton}
          aria-label="Download report"
          disabled={!report || busy}
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={6}
          align="end"
          className="z-[100] min-w-44 rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-1 shadow-lg"
        >
          {[
            "Copy contents",
            "Export to Markdown",
            "Export to Word",
            "Export to PDF",
          ].map((label, i) => (
            <DropdownMenu.Item
              key={label}
              className="cursor-pointer rounded-lg px-3 py-2 text-[13px] outline-none data-[highlighted]:bg-[var(--ui-hover-wash)]"
              onSelect={() => {
                if (i === 0) {
                  void navigator.clipboard
                    .writeText(report!.markdown)
                    .catch(() =>
                      setError(
                        "Could not copy the report. Check clipboard permissions.",
                      ),
                    );
                } else void save((["md", "docx", "pdf"] as const)[i - 1]);
              }}
            >
              {label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
  const duration = report
    ? `${Math.floor(report.elapsedSeconds / 60)}m ${report.elapsedSeconds % 60}s`
    : "";
  return (
    <div className="my-3 min-w-0" data-research-report-card>
      <p className="mb-2 text-[12px] text-[var(--ui-fg-muted)]">
        {report
          ? `Research completed in ${duration} · ${report.citations.length} citations · ${state.search_count} searches`
          : "Saving research report…"}
      </p>
      <section className="overflow-hidden rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)]">
        <div className="flex items-center gap-2.5 p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
            <FileText className="h-4 w-4" />
          </span>
          <button
            className="research-button no-hover-overlay min-w-0 flex-1 truncate text-left text-[14px] font-medium"
            disabled={!report}
            onClick={() => setOpen(true)}
          >
            {report?.title ?? state.title}
          </button>
          {downloadMenu}
          <button
            aria-label="Open research report"
            className={iconButton}
            disabled={!report}
            onClick={() => setOpen(true)}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        {report ? (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
              }
            }}
            className="relative block max-h-56 w-full cursor-pointer overflow-hidden px-5 pb-5 text-left"
            onClick={() => setOpen(true)}
            aria-label="View complete research report"
          >
            <div inert className="research-report-markdown pointer-events-none">
              <MarkdownOrchestrator text={report.markdown.slice(0, 2500)} />
            </div>
            <span className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[var(--ui-field-bg)] to-transparent" />
          </div>
        ) : null}
      </section>
      {error ? (
        <p
          role="alert"
          className="mt-2 text-[12px] text-[var(--settings-danger)]"
        >
          {error}{" "}
          <button className="underline" onClick={() => setRetry((n) => n + 1)}>
            Retry
          </button>
        </p>
      ) : null}
      <ResearchSidebar open={open} onOpenChange={setOpen} expanded={expanded}>
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--ui-border-subtle)] px-3">
          <Dialog.Title className="mr-auto flex items-center gap-1.5 rounded-full border border-[var(--ui-border-subtle)] px-3 py-1 text-[13px] font-medium">
            <Telescope className="h-3.5 w-3.5 text-blue-500" />
            Deep Research
          </Dialog.Title>
          <button
            className={iconButton}
            aria-label={
              expanded
                ? "Collapse report"
                : "Expand report to main content area"
            }
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <Dialog.Close
            aria-label="Close research report"
            className={iconButton}
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </div>
        <div
          className="research-report-body flex min-h-0 flex-1"
          data-has-details={!!tab || undefined}
        >
          <div className="research-report-document flex min-w-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 justify-end gap-2 border-b border-[var(--ui-border-subtle)] px-3 py-2">
              {downloadMenu}
              <button
                className={iconButton}
                aria-label="Sources and activity"
                title="Sources and activity"
                onClick={() => setTab(tab ? null : "sources")}
              >
                <Waypoints className="h-4 w-4" />
              </button>
            </div>
            <div className="research-report-markdown min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 md:p-7">
              {report ? <MarkdownOrchestrator text={report.markdown} /> : null}
            </div>
          </div>
          {tab ? (
            <aside
              aria-label="Sources and activity"
              className="research-report-details flex min-w-0 shrink-0 flex-col border-l border-[var(--ui-border-subtle)]"
            >
              <div className="flex h-11 shrink-0 items-center gap-1 border-b border-[var(--ui-border-subtle)] px-2">
                <button
                  className={`rounded-lg px-2 py-1 text-[12px] ${tab === "sources" ? "bg-[var(--ui-hover-wash)]" : ""}`}
                  onClick={() => setTab("sources")}
                >
                  Sources
                </button>
                <button
                  className={`rounded-lg px-2 py-1 text-[12px] ${tab === "activity" ? "bg-[var(--ui-hover-wash)]" : ""}`}
                  onClick={() => setTab("activity")}
                >
                  Activity · {duration}
                </button>
                <button
                  className={`${iconButton} ml-auto`}
                  aria-label="Close sources and activity"
                  onClick={() => setTab(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                {tab === "sources" ? (
                  <>
                    <h3 className="mb-4 text-[12px] text-[var(--ui-fg-muted)]">
                      Citations · {report?.citations.length ?? 0}
                    </h3>
                    <ol className="space-y-4">
                      {report?.citations.map((source, i) => (
                        <li key={source.url}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg p-1 hover:bg-[var(--ui-hover-wash)]"
                          >
                            <span className="text-[11px] text-[var(--ui-fg-muted)]">
                              {new URL(source.url).hostname}
                            </span>
                            <div className="mt-1 flex gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ui-hover-wash)] text-[10px]">
                                {i + 1}
                              </span>
                              <span className="min-w-0 text-[13px] font-medium leading-5 line-clamp-2">
                                {source.title}
                              </span>
                            </div>
                            {source.snippet ? (
                              <p className="mt-1 pl-7 text-[12px] leading-5 text-[var(--ui-fg-muted)] line-clamp-3">
                                {source.snippet}
                              </p>
                            ) : null}
                          </a>
                        </li>
                      ))}
                    </ol>
                    {!report?.citations.length ? (
                      <p className="text-[12px] text-[var(--ui-fg-muted)]">
                        No linked citations were included in this report.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <h3 className="mb-3 text-[12px] font-medium">
                      Research Activity
                    </h3>
                    {activity?.agentTrace?.steps.length ? (
                      <AgentTraceView
                        steps={activity.agentTrace.steps}
                        isActive={false}
                        isWorking={false}
                        keepExpanded
                        startedAtMs={activity.agentTrace.startedAtMs}
                        completedAtMs={activity.agentTrace.completedAtMs}
                        renderNarration={(step) => (
                          <AssistantContentRenderer
                            content={step.content}
                            messageId={activity.id}
                            isStreaming={false}
                            streamKey={step.id}
                            detailLevel="full"
                          />
                        )}
                      />
                    ) : (
                      <p className="text-[12px] text-[var(--ui-fg-muted)]">
                        Loading research activity…
                      </p>
                    )}
                  </>
                )}
              </div>
            </aside>
          ) : null}
        </div>
        {error ? (
          <p
            role="alert"
            className="px-3 py-2 text-[12px] text-[var(--settings-danger)]"
          >
            {error}
          </p>
        ) : null}
      </ResearchSidebar>
    </div>
  );
}
