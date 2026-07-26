"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pause,
  Play,
  Trash2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppLayout } from "@/components/app-layout-context";
import { ProjectsMobileHeader } from "@/components/projects/projects-mobile-header";
import { APP_ROUTES } from "@/lib/app-routes";
import { AppHref } from "@/components/app-href";
import {
  NewScheduledTaskModal,
  type NewScheduledTaskPayload,
} from "@/components/scheduled-tasks/new-scheduled-task-modal";
import {
  frequencyLabel,
  formatTimeLabel,
} from "@/server/services/scheduled-tasks-schedule";
import { stashScheduleChatDraft } from "@/lib/schedule-chat-draft";

type ScheduledTask = {
  id: string;
  name: string;
  requirement: string;
  frequency: "once" | "daily" | "weekly" | "monthly";
  time_local: string;
  timezone: string;
  run_date: string | null;
  day_of_week: number | null;
  day_of_month: number | null;
  expires_at: string | null;
  status: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_chat_id: string | null;
  run_count: number;
};

function scheduleSummary(task: ScheduledTask): string {
  const freq = frequencyLabel(task.frequency);
  const time = formatTimeLabel(task.time_local);
  if (task.frequency === "weekly" && task.day_of_week != null) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${freq} · ${days[task.day_of_week]} ${time}`;
  }
  if (task.frequency === "monthly" && task.day_of_month != null) {
    return `${freq} · day ${task.day_of_month} · ${time}`;
  }
  if (task.frequency === "once" && task.run_date) {
    return `${freq} · ${task.run_date} · ${time}`;
  }
  return `${freq} · ${time}`;
}

function nextRunLabel(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string | { message?: string };
      message?: string;
    };
    if (typeof body.error === "string") return body.error;
    if (body.error?.message) return body.error.message;
    return body.message || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function ScheduledTasksView() {
  const isMobile = useIsMobile();
  const { openMobileNav } = useAppLayout();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/scheduled-tasks", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const json = (await res.json()) as {
        data?: { tasks?: ScheduledTask[] };
        tasks?: ScheduledTask[];
      };
      const list = json.data?.tasks ?? json.tasks ?? [];
      setTasks(list);
    } catch (err) {
      toast({
        title: "Couldn’t load tasks",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const scheduleViaChatHref = `${APP_ROUTES.newChat}?intent=schedule`;

  const handleCreate = async (payload: NewScheduledTaskPayload) => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/scheduled-tasks", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      setModalOpen(false);
      toast({ title: "Scheduled task created" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (id: string, status: "active" | "paused") => {
    const res = await fetch(`/api/v1/scheduled-tasks/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast({
        title: "Update failed",
        description: await readApiError(res),
        variant: "destructive",
      });
      return;
    }
    await load();
  };

  const removeTask = async (id: string) => {
    const res = await fetch(`/api/v1/scheduled-tasks/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      toast({
        title: "Delete failed",
        description: await readApiError(res),
        variant: "destructive",
      });
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast({ title: "Task deleted" });
  };

  const CreateMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-[14px] font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Create
          <ChevronDown className="h-4 w-4 opacity-90" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[200px] rounded-xl border border-black/[0.06] p-1 shadow-lg"
      >
        <DropdownMenuItem
          className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[14px]"
          onSelect={() => setModalOpen(true)}
        >
          <Pencil className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
          Create manually
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <AppHref
            href={scheduleViaChatHref}
            onClick={() => {
              stashScheduleChatDraft();
            }}
            className="cursor-pointer gap-2.5 rounded-lg px-2.5 py-2 text-[14px]"
          >
            <MessageSquarePlus
              className="h-4 w-4 text-zinc-500"
              strokeWidth={1.75}
            />
            Create via chat
          </AppHref>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white font-sans">
      {isMobile ? (
        <ProjectsMobileHeader
          title="Scheduled Tasks"
          onOpenMobileNav={openMobileNav}
          trailing={CreateMenu}
        />
      ) : null}

      <div className="mobile-page-inset app-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold tracking-tight text-zinc-900 sm:text-[28px]">
                Scheduled Tasks
              </h1>
              <p className="mt-1.5 max-w-xl text-[14px] leading-5 text-zinc-500">
                Let Clauxen run tasks on schedule and deliver results
                automatically.
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              {CreateMenu}
              <AppHref
                href={APP_ROUTES.newChat}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </AppHref>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-20 text-[14px] text-zinc-400">
              Loading…
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <div className="mb-5 text-zinc-300">
                <CalendarClock
                  className="h-16 w-16"
                  strokeWidth={1}
                  absoluteStrokeWidth
                />
              </div>
              <p className="text-[15px] text-zinc-500">
                Create a scheduled task.
              </p>
              <div className="mt-3 flex items-center gap-3 text-[14px]">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  Add manually
                </button>
                <span className="text-zinc-300">or</span>
                <AppHref
                  href={scheduleViaChatHref}
                  onClick={() => {
                    stashScheduleChatDraft();
                  }}
                  className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  Create via chat
                </AppHref>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 py-3.5 first:pt-0"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
                    <CalendarClock className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[15px] font-medium text-zinc-900">
                        {task.name}
                      </p>
                      {task.status === "paused" ? (
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                          Paused
                        </span>
                      ) : null}
                      {task.status === "completed" ? (
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                          Done
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-zinc-500">
                      {scheduleSummary(task)}
                      {task.next_run_at && task.status === "active"
                        ? ` · Next ${nextRunLabel(task.next_run_at)}`
                        : ""}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Task actions"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl">
                      {task.last_chat_id ? (
                        <DropdownMenuItem asChild>
                          <AppHref href={APP_ROUTES.chat(task.last_chat_id)}>
                            Open last run
                          </AppHref>
                        </DropdownMenuItem>
                      ) : null}
                      {task.status === "active" ? (
                        <DropdownMenuItem
                          onSelect={() => void patchStatus(task.id, "paused")}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </DropdownMenuItem>
                      ) : task.status === "paused" ? (
                        <DropdownMenuItem
                          onSelect={() => void patchStatus(task.id, "active")}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Resume
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onSelect={() => void removeTask(task.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <NewScheduledTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
        saving={saving}
      />
    </div>
  );
}
