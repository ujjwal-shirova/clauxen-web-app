"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Clock3,
  Pause,
  Play,
  Plus,
  RotateCw,
} from "lucide-react";
import { AutomationEditorDialog } from "./automation-editor-dialog";
import { AutomationIcon } from "./automation-icon";
import {
  AUTOMATION_PRESETS,
  type AutomationPreset,
} from "./automation-presets";
import {
  createAutomation,
  deleteAutomation,
  listAutomationRuns,
  listAutomations,
  updateAutomation,
  type ApiAutomation,
  type ApiAutomationRun,
  type AutomationInput,
} from "@/lib/api/automations";
import { useToast } from "@/hooks/use-toast";
import { appPage } from "@/lib/app-page-chrome";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/lib/app-routes";
import { useAppLayout } from "@/components/app-layout-context";
import { MobileMenuButton } from "@/components/mobile-menu-button";

type EditorValue = AutomationPreset | ApiAutomation | null;
const CATEGORIES = [
  "News",
  "Productivity",
  "Finance",
  "Research",
  "Lifestyle",
] as const;
const WEEKDAYS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

function timeLabel(timeLocal: string) {
  const [hours, minutes] = timeLocal.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function presetSchedule(preset: AutomationPreset) {
  if (preset.frequency === "weekly")
    return `${WEEKDAYS[preset.dayOfWeek ?? 0]} at ${timeLabel(preset.timeLocal)}`;
  return `${preset.frequency.charAt(0).toUpperCase()}${preset.frequency.slice(1)} at ${timeLabel(preset.timeLocal)}`;
}

function taskSchedule(task: ApiAutomation) {
  if (task.frequency === "weekly")
    return `${WEEKDAYS[task.day_of_week ?? 0]} at ${timeLabel(task.time_local)}`;
  if (task.frequency === "monthly")
    return `Monthly on day ${task.day_of_month ?? 1} at ${timeLabel(task.time_local)}`;
  if (task.frequency === "once")
    return `${task.run_date ?? "Once"} at ${timeLabel(task.time_local)}`;
  return `Daily at ${timeLabel(task.time_local)}`;
}

export function AutomationsView() {
  const { toast } = useToast();
  const { isMobile, isSidebarCollapsed, openMobileNav } = useAppLayout();
  const showMobileMenu = isMobile && isSidebarCollapsed;
  const [tab, setTab] = useState<"automations" | "runs">("automations");
  const [tasks, setTasks] = useState<ApiAutomation[]>([]);
  const [runs, setRuns] = useState<ApiAutomationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorValue, setEditorValue] = useState<EditorValue>(null);

  const activePresets = useMemo(
    () => new Map(tasks.map((task) => [task.name, task])),
    [tasks],
  );

  useEffect(() => {
    let cancelled = false;
    void listAutomations()
      .then(({ tasks: loaded }) => {
        if (!cancelled) setTasks(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          toast({
            title: "Couldn’t load automations",
            description:
              error instanceof Error ? error.message : "Try again shortly.",
            variant: "destructive",
          });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (tab !== "runs") return;
    let cancelled = false;
    const load = async () => {
      setRunsLoading(true);
      try {
        const result = await listAutomationRuns();
        if (!cancelled) setRuns(result.runs);
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Couldn’t load runs",
            description:
              error instanceof Error ? error.message : "Try again shortly.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setRunsLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tab, toast]);

  const openEditor = (value: EditorValue) => {
    setEditorValue(value);
    setEditorOpen(true);
  };

  const save = async (draft: AutomationInput & { id?: string }) => {
    setSaving(true);
    try {
      if (draft.id) {
        const { task } = await updateAutomation(draft.id, draft);
        setTasks((current) =>
          current.map((item) => (item.id === task.id ? task : item)),
        );
        toast({ title: "Automation updated" });
      } else {
        const { task } = await createAutomation(draft);
        setTasks((current) => [task, ...current]);
        toast({
          title: "Automation created",
          description: `Next run scheduled in ${task.timezone}.`,
        });
      }
      setEditorOpen(false);
    } catch (error) {
      toast({
        title: "Couldn’t save automation",
        description:
          error instanceof Error
            ? error.message
            : "Check the schedule and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    try {
      await deleteAutomation(id);
      setTasks((current) => current.filter((item) => item.id !== id));
      setEditorOpen(false);
      toast({ title: "Automation deleted" });
    } catch (error) {
      toast({
        title: "Couldn’t delete automation",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (task: ApiAutomation) => {
    const status = task.status === "active" ? "paused" : "active";
    try {
      const result = await updateAutomation(task.id, { status });
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? result.task : item)),
      );
    } catch (error) {
      toast({
        title: "Couldn’t update automation",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={appPage.surface}>
      <header className="w-full shrink-0">
        <div className="mobile-page-inset mx-auto w-full max-w-[1120px] px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pb-4 sm:pt-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              {showMobileMenu ? (
                <MobileMenuButton
                  onClick={openMobileNav}
                  aria-controls="app-primary-nav"
                />
              ) : null}
              <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-zinc-950 sm:text-[34px]">
                Automations
              </h1>
            </div>
            <button
              type="button"
              onClick={() => openEditor(null)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-zinc-950 px-4 text-[14px] font-medium text-white"
            >
              <Plus className="size-4" />
              New Automation
            </button>
          </div>
          <div
            className="mt-6 inline-flex rounded-full bg-black/[0.04] p-1"
            role="tablist"
            aria-label="Automation views"
          >
            {(["automations", "runs"] as const).map((item) => (
              <button
                key={item}
                role="tab"
                aria-selected={tab === item}
                type="button"
                onClick={() => setTab(item)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-medium capitalize text-zinc-500 transition",
                  tab === item && "bg-white text-zinc-900 shadow-sm",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="app-scrollbar flex-1 overflow-y-auto">
        <main className="mobile-page-inset mx-auto w-full max-w-[1120px] px-4 pb-24 pt-2 sm:px-8">
          {tab === "runs" ? (
            runsLoading && runs.length === 0 ? (
              <div className="flex min-h-[380px] items-center justify-center text-zinc-500">
                <RotateCw className="size-5 animate-spin" />
              </div>
            ) : runs.length === 0 ? (
              <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-black/[0.04] text-zinc-500">
                  <RotateCw className="size-5" />
                </div>
                <h2 className="text-[17px] font-semibold">No recent runs</h2>
                <p className="mt-1 max-w-sm text-[14px] leading-5 text-zinc-500">
                  Queued and completed automation runs will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-2xl border border-black/[0.07] bg-[#f8f8f8] p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="truncate text-[15px] font-semibold">
                          {run.task_name}
                        </h2>
                        <p className="mt-1 text-[12px] text-zinc-500">
                          {new Date(run.queued_at).toLocaleString()} · attempt{" "}
                          {run.attempt_count}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
                          run.status === "success" &&
                            "bg-emerald-100 text-emerald-700",
                          run.status === "failed" && "bg-red-100 text-red-700",
                          (run.status === "queued" ||
                            run.status === "running") &&
                            "bg-amber-100 text-amber-700",
                          run.status === "skipped" &&
                            "bg-zinc-200 text-zinc-600",
                        )}
                      >
                        {run.status}
                      </span>
                    </div>
                    {run.summary || run.error_message ? (
                      <p className="mt-3 line-clamp-3 text-[13px] leading-5 text-zinc-600">
                        {run.summary || run.error_message}
                      </p>
                    ) : null}
                    {run.chat_id ? (
                      <a
                        href={APP_ROUTES.chat(run.chat_id)}
                        className="mt-3 inline-flex text-[13px] font-medium text-zinc-900 underline underline-offset-4"
                      >
                        Open result
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-9">
              {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={index}
                      className="h-44 animate-pulse rounded-3xl bg-black/[0.04]"
                    />
                  ))}
                </div>
              ) : null}

              {!loading && tasks.length > 0 ? (
                <section>
                  <h2 className="mb-3 text-[15px] font-semibold text-zinc-700">
                    Your automations
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tasks.map((task) => (
                      <article
                        key={task.id}
                        onClick={() => openEditor(task)}
                        onKeyDown={(event) => {
                          if (
                            event.target === event.currentTarget &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            openEditor(task);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="group relative min-h-40 cursor-pointer rounded-3xl bg-[#f7f7f7] p-5 ring-1 ring-black/[0.055] transition duration-200 hover:-translate-y-0.5 hover:ring-black/[0.12]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex size-9 items-center justify-center rounded-xl bg-white text-zinc-500 shadow-sm">
                            <CalendarClock className="size-[18px]" />
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleTask(task);
                            }}
                            className="flex h-8 items-center gap-1 rounded-full border border-black/[0.08] bg-white px-3 text-[12px] font-medium"
                          >
                            {task.status === "active" ? (
                              <Pause className="size-3.5" />
                            ) : (
                              <Play className="size-3.5" />
                            )}
                            {task.status === "active" ? "Pause" : "Resume"}
                          </button>
                        </div>
                        <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.01em]">
                          {task.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-zinc-500">
                          {task.requirement}
                        </p>
                        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-zinc-500">
                          <Clock3 className="size-3.5" />
                          {taskSchedule(task)}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {CATEGORIES.map((category) => {
                const presets = AUTOMATION_PRESETS.filter(
                  (preset) => preset.category === category,
                );
                return (
                  <section key={category}>
                    <h2 className="mb-3 text-[15px] font-semibold text-zinc-700">
                      {category}
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {presets.map((preset) => {
                        const addedTask = activePresets.get(preset.name);
                        const added = Boolean(addedTask);
                        return (
                          <article
                            key={preset.id}
                            onClick={() => openEditor(addedTask ?? preset)}
                            onKeyDown={(event) => {
                              if (
                                event.target === event.currentTarget &&
                                (event.key === "Enter" || event.key === " ")
                              ) {
                                event.preventDefault();
                                openEditor(addedTask ?? preset);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className="group min-h-44 cursor-pointer rounded-3xl bg-[#f7f7f7] p-5 ring-1 ring-black/[0.055] transition duration-200 hover:-translate-y-0.5 hover:ring-black/[0.12]"
                          >
                            <div className="flex items-start justify-between">
                              <div
                                className={cn(
                                  "flex size-9 items-center justify-center rounded-xl bg-white shadow-sm",
                                  category === "News" && "text-indigo-500",
                                  category === "Productivity" &&
                                    "text-pink-500",
                                  category === "Finance" && "text-orange-500",
                                  category === "Research" && "text-violet-500",
                                  category === "Lifestyle" &&
                                    "text-emerald-500",
                                )}
                              >
                                <AutomationIcon
                                  name={preset.icon}
                                  className="size-[18px]"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditor(addedTask ?? preset);
                                }}
                                className="h-8 rounded-full border border-black/[0.08] bg-white px-3 text-[12px] font-medium"
                              >
                                {added ? "Added" : "Add"}
                              </button>
                            </div>
                            <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.01em]">
                              {preset.name}
                            </h3>
                            <p className="mt-1 min-h-10 text-[13px] leading-5 text-zinc-500">
                              {preset.description}
                            </p>
                            <p className="mt-4 flex items-center gap-1.5 text-[12px] text-zinc-500">
                              <Clock3 className="size-3.5" />
                              {presetSchedule(preset)}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <AutomationEditorDialog
        open={editorOpen}
        value={editorValue}
        saving={saving}
        onOpenChange={setEditorOpen}
        onSave={save}
        onDelete={remove}
      />
    </div>
  );
}
