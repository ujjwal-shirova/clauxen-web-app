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
import { env } from "@/server/config/env";
import { sendAutomationRunEmail } from "@/server/billing/billing-email";

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

function assertDate(
  value: string | null | undefined,
  label: string,
): string | null {
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
  notificationMode?: "email_app" | "email_only" | "app_only" | "off";
  modelMode?: "fast" | "thinking";
  skillIds?: string[];
  attachmentRefs?: Array<Record<string, unknown>>;
};

function cleanIds(values: string[] | undefined, label: string): string[] {
  if (!values) return [];
  const cleaned = [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ];
  if (cleaned.length > 20 || cleaned.some((value) => value.length > 160)) {
    throw new AppError(`${label} selection is invalid.`, 400);
  }
  return cleaned;
}

export function validateCreateInput(raw: CreateScheduledTaskInput) {
  const name = raw.name?.trim() ?? "";
  if (!name) throw new AppError("Name is required.", 400);
  if (name.length > MAX_NAME)
    throw new AppError("Name is too long (max 50).", 400);

  const requirement = raw.requirement?.trim() ?? "";
  if (!requirement) throw new AppError("Requirement is required.", 400);
  if (requirement.length > MAX_REQUIREMENT) {
    throw new AppError("Requirement is too long (max 8000).", 400);
  }

  if (!FREQUENCIES.has(raw.frequency)) {
    throw new AppError(
      "Frequency must be once, daily, weekly, or monthly.",
      400,
    );
  }

  parseTimeLocal(raw.timeLocal);
  const timezone = assertTimezone(raw.timezone ?? "UTC");
  const runDate = assertDate(raw.runDate, "runDate");
  const expiresAt = assertDate(raw.expiresAt, "expiresAt");
  const notificationMode = raw.notificationMode ?? "email_app";
  if (
    !["email_app", "email_only", "app_only", "off"].includes(notificationMode)
  ) {
    throw new AppError("Invalid notification mode.", 400);
  }
  const modelMode = raw.modelMode ?? "fast";
  if (!["fast", "thinking"].includes(modelMode)) {
    throw new AppError("Invalid model mode.", 400);
  }

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
    notificationMode,
    modelMode,
    skillIds: cleanIds(raw.skillIds, "Skill"),
    attachmentRefs: Array.isArray(raw.attachmentRefs)
      ? raw.attachmentRefs.slice(0, 20)
      : [],
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

export async function createTask(
  userId: string,
  raw: CreateScheduledTaskInput,
) {
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
        nextRunAt:
          patch.status === "paused" ? null : (nextRunAt?.toISOString() ?? null),
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
    notificationMode: patch.notificationMode ?? existing.notification_mode,
    modelMode: patch.modelMode ?? existing.model_mode,
    skillIds: patch.skillIds ?? existing.skill_ids,
    attachmentRefs: patch.attachmentRefs ?? existing.attachment_refs,
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
    notificationMode: validated.notificationMode,
    modelMode: validated.modelMode,
    skillIds: validated.skillIds,
    attachmentRefs: validated.attachmentRefs,
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
  return [`[Scheduled task: ${task.name}]`, ``, task.requirement.trim()].join(
    "\n",
  );
}

async function deliverRunNotification(
  task: tasksRepo.ScheduledTaskRow,
  run: tasksRepo.ScheduledTaskRunRow,
  body: string,
) {
  if (task.notification_mode === "off") return;
  if (
    task.notification_mode === "email_app" ||
    task.notification_mode === "app_only"
  ) {
    await tasksRepo.createAutomationNotification({ task, run, body });
  }
  if (
    task.notification_mode === "email_app" ||
    task.notification_mode === "email_only"
  ) {
    const recipient = await tasksRepo.getAutomationUserEmail(task.user_id);
    if (recipient?.email) {
      const chatUrl = run.chat_id
        ? `${env.appUrl.replace(/\/+$/, "")}/c/${encodeURIComponent(run.chat_id)}`
        : null;
      await sendAutomationRunEmail({
        to: recipient.email,
        taskName: task.name,
        status: run.status as "success" | "failed" | "skipped",
        summary: body,
        chatUrl,
      });
    }
  }
}

/**
 * Execute one claimed task: create a chat, stream generation, record the run.
 * Consumes the SSE stream to completion (no client).
 */
export async function executeScheduledRun(
  runId: string,
): Promise<{ runId: string; chatId: string | null; status: string }> {
  const acquired = await tasksRepo.acquireScheduledTaskRun(runId);
  if (!acquired) {
    const existing = await tasksRepo.getScheduledTaskRun(runId);
    if (!existing) throw new AppError("Scheduled run not found.", 404);
    if (["success", "failed", "skipped"].includes(existing.status)) {
      return { runId, chatId: existing.chat_id, status: existing.status };
    }
    throw new AppError("Scheduled run is already being executed.", 409);
  }
  const { task, run } = acquired;

  if (task.status !== "active") {
    const skipped = await tasksRepo.finishScheduledTaskRun({
      runId,
      status: "skipped",
      summary: "Automation was not active when the queued run started.",
    });
    await tasksRepo.markScheduledTaskAfterRun({
      taskId: task.id,
      runId,
      nextRunAt: null,
      status: task.status,
      lastRunStatus: "skipped",
    });
    if (skipped) {
      await deliverRunNotification(
        task,
        skipped,
        skipped.summary ?? "Automation skipped.",
      );
    }
    return { runId, chatId: null, status: "skipped" };
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

    const generation = beginChatGeneration(chatId);
    if (!generation) {
      throw new Error("Generation lease unavailable");
    }
    const generationController = generation.controller;

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
        ensureLease: () => generation.lease,
        generateChatTitle: true,
        chatModel:
          task.model_mode === "thinking" ? env.thinkingModel : env.fastModel,
        extendedThinking: task.model_mode === "thinking",
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

  if (!ok && run.attempt_count < 5) {
    await tasksRepo.requeueScheduledTaskRun(
      run.id,
      errorMessage ?? "Run failed",
    );
    throw new AppError(errorMessage ?? "Scheduled run failed.", 503);
  }

  const runStatus: "success" | "failed" = ok ? "success" : "failed";
  const finishedRun = await tasksRepo.finishScheduledTaskRun({
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
    runId,
    nextRunAt: nextStatus === "active" && next ? next.toISOString() : null,
    status: nextStatus,
    lastRunStatus: runStatus,
    lastChatId: chatId,
  });

  if (finishedRun) {
    await deliverRunNotification(
      task,
      finishedRun,
      summary ??
        (ok
          ? "Your automation completed successfully."
          : (errorMessage ?? "Your automation failed.")),
    );
  }

  return { runId: run.id, chatId, status: runStatus };
}

/** Claim due schedules into durable queue jobs. No inference runs here. */
export async function dispatchDueScheduledTasks(limit = 8): Promise<{
  claimed: number;
  jobs: tasksRepo.QueuedScheduledRun[];
}> {
  const jobs = await tasksRepo.claimDueScheduledTasks(limit);
  return { claimed: jobs.length, jobs };
}
