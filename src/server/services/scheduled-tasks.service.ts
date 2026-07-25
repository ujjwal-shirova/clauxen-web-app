import { randomUUID } from "crypto";
import { AppError } from "@/server/db/errors";
import * as tasksRepo from "@/server/repositories/scheduled-tasks.repository";
import * as chatService from "@/server/services/chat.service";
import {
  beginChatGeneration,
  endChatGeneration,
} from "@/server/chat/generation-registry";
import {
  computeNextRunAt,
  parseTimeLocal,
  type ScheduleFrequency,
  type ScheduleSpec,
} from "@/server/services/scheduled-tasks-schedule";

const MAX_NAME = 50;
const MAX_REQUIREMENT = 8000;
const MAX_ACTIVE_TASKS = 15;

const FREQUENCIES = new Set<ScheduleFrequency>([
  "once",
  "daily",
  "weekly",
  "monthly",
]);

function assertTimezone(tz: string): string {
  const cleaned = tz.trim() || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: cleaned });
    return cleaned;
  } catch {
    throw new AppError("Invalid timezone.", 400);
  }
}

function assertDate(value: string | null | undefined, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${label} must be YYYY-MM-DD.`, 400);
  }
  return value;
}

export type CreateScheduledTaskInput = {
  name: string;
  requirement: string;
  frequency: ScheduleFrequency;
  timeLocal: string;
  timezone?: string;
  runDate?: string | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  expiresAt?: string | null;
  source?: "manual" | "chat";
};

export function validateCreateInput(raw: CreateScheduledTaskInput) {
  const name = raw.name?.trim() ?? "";
  if (!name) throw new AppError("Name is required.", 400);
  if (name.length > MAX_NAME) throw new AppError("Name is too long (max 50).", 400);

  const requirement = raw.requirement?.trim() ?? "";
  if (!requirement) throw new AppError("Requirement is required.", 400);
  if (requirement.length > MAX_REQUIREMENT) {
    throw new AppError("Requirement is too long (max 8000).", 400);
  }

  if (!FREQUENCIES.has(raw.frequency)) {
    throw new AppError("Frequency must be once, daily, weekly, or monthly.", 400);
  }

  parseTimeLocal(raw.timeLocal);
  const timezone = assertTimezone(raw.timezone ?? "UTC");
  const runDate = assertDate(raw.runDate, "runDate");
  const expiresAt = assertDate(raw.expiresAt, "expiresAt");

  let dayOfWeek = raw.dayOfWeek ?? null;
  let dayOfMonth = raw.dayOfMonth ?? null;

  if (raw.frequency === "once" && !runDate) {
    throw new AppError("Run date is required for one-time tasks.", 400);
  }
  if (raw.frequency === "weekly") {
    if (dayOfWeek === null || dayOfWeek === undefined) {
      throw new AppError("Day of week is required for weekly tasks.", 400);
    }
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new AppError("Day of week must be 0–6 (Sunday–Saturday).", 400);
    }
  } else {
    dayOfWeek = null;
  }
  if (raw.frequency === "monthly") {
    if (dayOfMonth === null || dayOfMonth === undefined) {
      throw new AppError("Day of month is required for monthly tasks.", 400);
    }
    if (dayOfMonth < 1 || dayOfMonth > 31) {
      throw new AppError("Day of month must be 1–31.", 400);
    }
  } else {
    dayOfMonth = null;
  }
  if (raw.frequency !== "once") {
    // runDate only meaningful for once
  }

  const spec: ScheduleSpec = {
    frequency: raw.frequency,
    timeLocal: raw.timeLocal.trim(),
    timezone,
    runDate: raw.frequency === "once" ? runDate : null,
    dayOfWeek,
    dayOfMonth,
    expiresAt,
  };

  const next = computeNextRunAt(spec, new Date());
  if (!next) {
    throw new AppError(
      "No future run time — check the schedule and expiration.",
      400,
    );
  }

  return {
    name,
    requirement,
    frequency: raw.frequency,
    timeLocal: raw.timeLocal.trim(),
    timezone,
    runDate: raw.frequency === "once" ? runDate : null,
    dayOfWeek,
    dayOfMonth,
    expiresAt,
    nextRunAt: next.toISOString(),
    source: raw.source ?? ("manual" as const),
  };
}

export async function listTasks(userId: string) {
  return tasksRepo.listScheduledTasks(userId);
}

export async function getTask(taskId: string, userId: string) {
  const task = await tasksRepo.getScheduledTask(taskId, userId);
  if (!task) throw new AppError("Scheduled task not found.", 404);
  return task;
}

export async function createTask(userId: string, raw: CreateScheduledTaskInput) {
  const active = await tasksRepo.countActiveScheduledTasks(userId);
  if (active >= MAX_ACTIVE_TASKS) {
    throw new AppError(
      `You can have at most ${MAX_ACTIVE_TASKS} active scheduled tasks.`,
      400,
    );
  }
  const validated = validateCreateInput(raw);
  const task = await tasksRepo.createScheduledTask({
    userId,
    ...validated,
  });
  if (!task) throw new AppError("Failed to create scheduled task.", 500);
  return task;
}

export async function updateTask(
  taskId: string,
  userId: string,
  patch: Partial<CreateScheduledTaskInput> & { status?: "active" | "paused" },
) {
  const existing = await getTask(taskId, userId);

  if (patch.status === "paused" || patch.status === "active") {
    if (Object.keys(patch).length === 1) {
      const nextRunAt =
        patch.status === "paused"
          ? null
          : computeNextRunAt(
              {
                frequency: existing.frequency,
                timeLocal: existing.time_local,
                timezone: existing.timezone,
                runDate: existing.run_date,
                dayOfWeek: existing.day_of_week,
                dayOfMonth: existing.day_of_month,
                expiresAt: existing.expires_at,
              },
              new Date(),
            );
      const updated = await tasksRepo.updateScheduledTask(taskId, userId, {
        status: patch.status,
        nextRunAt: patch.status === "paused" ? null : nextRunAt?.toISOString() ?? null,
      });
      if (!updated) throw new AppError("Scheduled task not found.", 404);
      return updated;
    }
  }

  const merged: CreateScheduledTaskInput = {
    name: patch.name ?? existing.name,
    requirement: patch.requirement ?? existing.requirement,
    frequency: patch.frequency ?? existing.frequency,
    timeLocal: patch.timeLocal ?? existing.time_local,
    timezone: patch.timezone ?? existing.timezone,
    runDate: patch.runDate !== undefined ? patch.runDate : existing.run_date,
    dayOfWeek:
      patch.dayOfWeek !== undefined ? patch.dayOfWeek : existing.day_of_week,
    dayOfMonth:
      patch.dayOfMonth !== undefined ? patch.dayOfMonth : existing.day_of_month,
    expiresAt:
      patch.expiresAt !== undefined ? patch.expiresAt : existing.expires_at,
  };

  const validated = validateCreateInput(merged);
  const updated = await tasksRepo.updateScheduledTask(taskId, userId, {
    name: validated.name,
    requirement: validated.requirement,
    frequency: validated.frequency,
    timeLocal: validated.timeLocal,
    timezone: validated.timezone,
    runDate: validated.runDate,
    dayOfWeek: validated.dayOfWeek,
    dayOfMonth: validated.dayOfMonth,
    expiresAt: validated.expiresAt,
    nextRunAt: validated.nextRunAt,
    status: patch.status ?? existing.status,
  });
  if (!updated) throw new AppError("Scheduled task not found.", 404);
  return updated;
}

export async function deleteTask(taskId: string, userId: string) {
  const deleted = await tasksRepo.softDeleteScheduledTask(taskId, userId);
  if (!deleted) throw new AppError("Scheduled task not found.", 404);
  return deleted;
}

function buildRunPrompt(task: tasksRepo.ScheduledTaskRow): string {
  return [
    `[Scheduled task: ${task.name}]`,
    ``,
    task.requirement.trim(),
  ].join("\n");
}

/**
 * Execute one claimed task: create a chat, stream generation, record the run.
 * Consumes the SSE stream to completion (no client).
 */
export async function executeScheduledTask(
  task: tasksRepo.ScheduledTaskRow,
): Promise<{ runId: string; chatId: string | null; ok: boolean }> {
  const run = await tasksRepo.createScheduledTaskRun({
    taskId: task.id,
    userId: task.user_id,
  });
  if (!run) {
    throw new Error("Failed to create run row");
  }

  const prompt = buildRunPrompt(task);
  let chatId: string | null = null;
  let ok = false;
  let errorMessage: string | null = null;
  let summary: string | null = null;

  try {
    const chat = await chatService.createChatForUser(task.user_id, {
      title: task.name.slice(0, 80),
    });
    if (!chat?.id) throw new Error("Failed to create chat for scheduled run");
    chatId = chat.id;

    const userClientId = `sched-u-${randomUUID()}`;
    const assistantClientId = `sched-a-${randomUUID()}`;

    const generationController = await beginChatGeneration(chatId);
    if (!generationController) {
      throw new Error("Generation lease unavailable");
    }

    try {
      const { stream, onComplete } = await chatService.streamChatGeneration({
        chatId,
        userId: task.user_id,
        messages: [{ role: "user", content: prompt }],
        turn: {
          content: prompt,
          userClientId,
          assistantClientId,
        },
        signal: generationController.signal,
        generateChatTitle: true,
      });

      // Drain SSE so the agent finishes and persists.
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      await onComplete();

      // Best-effort summary from last answer chunk in the SSE dump.
      const answerMatch = text.match(/"answer"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (answerMatch?.[1]) {
        try {
          summary = JSON.parse(`"${answerMatch[1]}"`).slice(0, 500);
        } catch {
          summary = answerMatch[1].slice(0, 500);
        }
      }
      ok = true;
    } finally {
      await endChatGeneration(chatId, generationController);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    ok = false;
  }

  const runStatus = ok ? "success" : "failed";
  await tasksRepo.finishScheduledTaskRun({
    runId: run.id,
    status: runStatus,
    chatId,
    errorMessage,
    summary,
  });

  const next = computeNextRunAt(
    {
      frequency: task.frequency,
      timeLocal: task.time_local,
      timezone: task.timezone,
      runDate: task.run_date,
      dayOfWeek: task.day_of_week,
      dayOfMonth: task.day_of_month,
      expiresAt: task.expires_at,
    },
    new Date(),
  );

  const nextStatus =
    task.frequency === "once" || !next ? "completed" : "active";

  await tasksRepo.markScheduledTaskAfterRun({
    taskId: task.id,
    nextRunAt: nextStatus === "active" && next ? next.toISOString() : null,
    status: nextStatus,
    lastRunStatus: runStatus,
    lastChatId: chatId,
  });

  return { runId: run.id, chatId, ok };
}

/** Dispatch due tasks — called by internal cron endpoint. */
export async function dispatchDueScheduledTasks(limit = 8): Promise<{
  claimed: number;
  results: Array<{ taskId: string; ok: boolean; chatId: string | null }>;
}> {
  const due = await tasksRepo.claimDueScheduledTasks(limit);
  const results: Array<{ taskId: string; ok: boolean; chatId: string | null }> =
    [];

  // Run sequentially to avoid stampeding inference quotas.
  for (const task of due) {
    try {
      const result = await executeScheduledTask(task);
      results.push({
        taskId: task.id,
        ok: result.ok,
        chatId: result.chatId,
      });
    } catch (err) {
      console.error("[scheduled-tasks] execute failed", task.id, err);
      results.push({ taskId: task.id, ok: false, chatId: null });
    }
  }

  return { claimed: due.length, results };
}
