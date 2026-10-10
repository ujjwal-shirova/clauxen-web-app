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
    <section className="h-full overflow-y-auto px-5 py-10 sm:px-12 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Scheduled tasks
            </h1>
            <p className="mt-3 text-base text-[hsl(var(--muted-foreground))]">
              Set a routine for Clauxen and keep your recurring work on track.
            </p>
          </div>
          <div className="flex overflow-hidden rounded-2xl no-hover-overlay bg-[hsl(var(--foreground))] text-[hsl(var(--background))]">
            <button
              onClick={createChat}
              className="no-hover-overlay px-5 py-3 text-base font-medium"
            >
              Create
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Choose how to create a task"
                className="no-hover-overlay border-l border-[hsl(var(--background)/0.2)] px-3"
              >
                <ChevronDown className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
                <DropdownMenuItem onSelect={createChat} className="gap-3 p-3">
                  <MessageCirclePlus className="size-5" />
                  Create via chat
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setEditing(null)}
                  className="gap-3 p-3"
                >
                  <Pencil className="size-5" />
                  Create manually
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {loading ? (
          <p
            role="status"
            className="py-20 text-[hsl(var(--muted-foreground))]"
          >
            Loading scheduled tasks…
          </p>
        ) : error ? (
          <div role="alert" className="py-16">
            <p>{error}</p>
            <button onClick={() => void load()} className="mt-4 underline">
              Try again
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
            <CalendarClock
              className="mb-7 size-24 text-[hsl(var(--muted-foreground)/0.35)]"
              strokeWidth={1}
            />
            <p className="text-lg text-[hsl(var(--muted-foreground))]">
              Create your first scheduled task
            </p>
            <p className="mt-3 text-base">
              <button
                onClick={() => setEditing(null)}
                className="text-blue-500 hover:underline"
              >
                Add manually
              </button>
              <span className="mx-2 text-[hsl(var(--muted-foreground))]">
                or
              </span>
              <button
                onClick={createChat}
                className="text-blue-500 hover:underline"
              >
                Create via chat
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {tasks.map((task) => (
              <article
                key={task.id}
                className="rounded-3xl border border-[hsl(var(--border))] p-6"
              >
                <div className="flex items-center gap-3">
                  <h2 className="min-w-0 flex-1 truncate text-xl font-semibold">
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
                      className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]"
                    >
                      <MoreHorizontal className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-44 rounded-2xl p-2"
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
                <p className="mt-5 min-h-16 whitespace-pre-wrap break-words text-[hsl(var(--muted-foreground))] line-clamp-3">
                  {task.requirement}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-[hsl(var(--muted-foreground))]">
                  <span className="flex items-center gap-2">
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
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {task.timezone} ·{" "}
                  {task.model_mode === "thinking" ? "Thinking" : "Instant"}
                  {task.last_run_status
                    ? ` · Last run: ${task.last_run_status}`
                    : ""}
                </p>
                {task.last_chat_id ? (
                  <button
                    className="mt-3 text-sm text-blue-500 hover:underline"
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
        <DialogContent>
          <DialogTitle>Delete scheduled task?</DialogTitle>
          <DialogDescription>
            “{deleting?.name}” will stop running. Existing results will remain
            in your chats.
          </DialogDescription>
          <div className="flex justify-end gap-3">
            <button
              disabled={!!busy}
              onClick={() => setDeleting(null)}
              className="rounded-xl bg-[hsl(var(--muted))] px-4 py-2"
            >
              Cancel
            </button>
            <button
              disabled={!!busy}
              onClick={() => deleting && void act(deleting, "delete")}
              className="rounded-xl bg-red-500 px-4 py-2 text-white"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
