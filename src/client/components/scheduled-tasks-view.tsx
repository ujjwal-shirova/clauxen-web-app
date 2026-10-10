"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  Clock,
  MessageCirclePlus,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import { stashScheduleChatDraft } from "@/lib/schedule-chat-draft";
import type { ScheduledTaskRow } from "@/server/repositories/scheduled-tasks.repository";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { ScheduledTaskForm } from "@/components/scheduled-task-form";
import { appBtn } from "@/lib/app-buttons";

export function ScheduledTasksView() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ScheduledTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduledTaskRow | null | undefined>(
    undefined,
  );
  const [deleting, setDeleting] = useState<ScheduledTaskRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ tasks: ScheduledTaskRow[] }>(
        "/api/v1/scheduled-tasks",
      );
      setTasks(data.tasks);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load scheduled tasks.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);
  const createChat = () => {
    stashScheduleChatDraft();
    router.push(`/new?schedule=${Date.now()}`, { scroll: false });
  };
  const act = async (
    task: ScheduledTaskRow,
    action: "pause" | "run" | "delete",
  ) => {
    setBusy(task.id);
    try {
      await apiFetch(
        `/api/v1/scheduled-tasks/${task.id}${action === "run" ? "/run" : ""}`,
        {
          method:
            action === "delete"
              ? "DELETE"
              : action === "run"
                ? "POST"
                : "PATCH",
          ...(action === "pause"
            ? {
                body: JSON.stringify({
                  status: task.status === "active" ? "paused" : "active",
                }),
              }
            : {}),
        },
      );
      if (action === "run")
        toast.success("Run queued. It will start on the next scheduler check.");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Task could not be updated.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="app-page-surface h-full overflow-y-auto px-4 pb-12 pt-6 sm:px-8 sm:pt-8">
      <div className="mx-auto w-full max-w-[1080px]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ui-border-subtle)] pb-5">
          <div>
            <h1 className="app-page-title">Scheduled tasks</h1>
            <p className="app-page-subtitle mt-1">
              Set a routine for Clauxen and keep your recurring work on track.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={createChat} className={appBtn.primary}>
              Create
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Choose how to create a task"
                className="ui-icon-button size-9"
              >
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                <DropdownMenuItem
                  onSelect={createChat}
                  className="gap-2 px-2.5 py-2 text-[13px]"
                >
                  <MessageCirclePlus className="size-4" />
                  Create via chat
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setEditing(null)}
                  className="gap-2 px-2.5 py-2 text-[13px]"
                >
                  <Pencil className="size-4" />
                  Create manually
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {loading ? (
          <p role="status" className="py-12 text-sm text-[var(--ui-fg-muted)]">
            Loading scheduled tasks…
          </p>
        ) : error ? (
          <div role="alert" className="py-12 text-sm">
            <p>{error}</p>
            <button onClick={() => void load()} className="mt-4 underline">
              Try again
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
            <CalendarClock
              className="mb-4 size-10 text-[var(--ui-fg-muted)] opacity-60"
              strokeWidth={1}
            />
            <p className="text-[15px] font-medium text-[var(--ui-fg)]">
              Create your first scheduled task
            </p>
            <p className="mt-2 text-[13px] text-[var(--ui-fg-muted)]">
              <button
                onClick={() => setEditing(null)}
                className="font-medium text-[var(--ui-fg)] underline-offset-4 hover:underline"
              >
                Add manually
              </button>
              <span className="mx-2 text-[hsl(var(--muted-foreground))]">
                or
              </span>
              <button
                onClick={createChat}
                className="font-medium text-[var(--ui-fg)] underline-offset-4 hover:underline"
              >
                Create via chat
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {tasks.map((task) => (
              <article
                key={task.id}
                className="rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-4 sm:p-5"
              >
                <div className="flex items-center gap-3">
                  <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {task.name}
                  </h2>
                  <Switch
                    aria-label={`Enable ${task.name}`}
                    checked={task.status === "active"}
                    disabled={busy === task.id || task.status === "completed"}
                    onCheckedChange={() => void act(task, "pause")}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Actions for ${task.name}`}
                      disabled={busy === task.id}
                      className="ui-icon-button size-8"
                    >
                      <MoreHorizontal className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-40 rounded-xl p-1"
                    >
                      <DropdownMenuItem
                        disabled={task.status !== "active"}
                        onSelect={() => void act(task, "run")}
                      >
                        <Play className="mr-2 size-4" />
                        Run now
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setEditing(task)}>
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setDeleting(task)}
                        className="text-red-500"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="mt-3 min-h-12 whitespace-pre-wrap break-words text-[13px] leading-5 text-[var(--ui-fg-muted)] line-clamp-3">
                  {task.requirement}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-border-subtle)] pt-3 text-[12px] text-[var(--ui-fg-muted)]">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {task.next_run_at
                      ? new Date(task.next_run_at).toLocaleString(undefined, {
                          timeZone: task.timezone,
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : task.status === "paused"
                        ? "Paused"
                        : "Completed"}
                  </span>
                  <span className="capitalize">{task.frequency}</span>
                </div>
                <p className="mt-2 text-[11px] text-[var(--ui-fg-muted)]">
                  {task.timezone} ·{" "}
                  {task.model_mode === "thinking" ? "Thinking" : "Instant"}
                  {task.last_run_status
                    ? ` · Last run: ${task.last_run_status}`
                    : ""}
                </p>
                {task.last_chat_id ? (
                  <button
                    className="mt-3 text-[12px] font-medium text-[var(--ui-fg)] underline-offset-4 hover:underline"
                    onClick={() => router.push(`/c/${task.last_chat_id}`)}
                  >
                    View latest result
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
      {editing !== undefined ? (
        <ScheduledTaskForm
          task={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void load();
          }}
        />
      ) : null}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent className="max-w-[400px] gap-4 rounded-2xl p-5">
          <DialogTitle>Delete scheduled task?</DialogTitle>
          <DialogDescription>
            “{deleting?.name}” will stop running. Existing results will remain
            in your chats.
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-1">
            <button
              disabled={!!busy}
              onClick={() => setDeleting(null)}
              className={appBtn.secondary}
            >
              Cancel
            </button>
            <button
              disabled={!!busy}
              onClick={() => deleting && void act(deleting, "delete")}
              className={`${appBtn.primary} !bg-[var(--settings-danger)] hover:!opacity-90 disabled:opacity-50`}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
