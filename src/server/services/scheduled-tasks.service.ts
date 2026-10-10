import { AppError } from "@/server/db/errors";
import * as tasksRepo from "@/server/repositories/scheduled-tasks.repository";
import * as chatService from "@/server/services/chat.service";
import { getGenerationJobByAssistantClientId } from "@/server/repositories/generation-jobs.repository";
import {
  computeNextRunAt,
  parseTimeLocal,
  isCalendarDate,
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
  if (!isCalendarDate(value)) {
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

  try {
    parseTimeLocal(raw.timeLocal);
  } catch {
    throw new AppError("Invalid time. Use HH:MM (24-hour).", 400);
  }
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
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new AppError("Day of week must be 0–6 (Sunday–Saturday).", 400);
    }
  } else {
    dayOfWeek = null;
  }
  if (raw.frequency === "monthly") {
    if (dayOfMonth === null || dayOfMonth === undefined) {
      throw new AppError("Day of month is required for monthly tasks.", 400);
    }
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
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
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      taskId,
    )
  )
    throw new AppError("Invalid scheduled task ID.", 400);
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
      if (patch.status === "active" && !nextRunAt) {
        throw new AppError(
          "This schedule has ended. Edit its date before enabling it.",
          400,
        );
      }
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
    nextRunAt:
      (patch.status ?? existing.status) === "paused"
        ? null
        : validated.nextRunAt,
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
  await getTask(taskId, userId);
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
      const sent = await sendAutomationRunEmail({
        to: recipient.email,
        taskName: task.name,
        status: run.status as "success" | "failed" | "skipped",
        summary: body,
        chatUrl,
      });
      if (!sent) throw new Error("Automation email delivery failed.");
    }
  }
}

/** Admit one stable turn. The generation watchdog owns execution and recovery. */
export async function executeScheduledRun(
  runId: string,
  executionOrigin: string,
) {
  const acquired = await tasksRepo.acquireScheduledTaskRun(runId);
  if (!acquired) {
    const existing = await tasksRepo.getScheduledTaskRun(runId);
    if (!existing) throw new AppError("Scheduled run not found.", 404);
    if (["success", "failed", "skipped"].includes(existing.status))
      return {
        runId,
        chatId: existing.chat_id,
        status: existing.status,
        jobId: null,
      };
    if (existing.chat_id) {
      const job = await getGenerationJobByAssistantClientId(
        existing.chat_id,
        existing.user_id,
        `sched-a-${runId}`,
      );
      if (job)
        return {
          runId,
          chatId: existing.chat_id,
          status: existing.status,
          jobId: job.id,
        };
    }
    throw new AppError("Scheduled run is already being admitted.", 409);
  }
  const { task, run } = acquired;
  // A previously accepted turn must be recovered even if the schedule was paused.
  if (run.chat_id) {
    const accepted = await getGenerationJobByAssistantClientId(
      run.chat_id,
      task.user_id,
      `sched-a-${run.id}`,
    );
    if (accepted)
      return {
        runId,
        chatId: run.chat_id,
        status: "running",
        jobId: accepted.id,
      };
  }
  if (task.status !== "active") {
    await tasksRepo.completeScheduledRun({
      runId,
      status: "skipped",
      attempt: run.attempt_count,
      summary: "Automation was not active when the queued run started.",
    });
    return { runId, chatId: run.chat_id, status: "skipped", jobId: null };
  }
  try {
    const chatId = await tasksRepo.ensureScheduledRunChat(run, task);
    const prompt = buildRunPrompt(task);
    const job = await chatService.acceptBackgroundChatTurn({
      chatId,
      userId: task.user_id,
      jobInput: {
        executionOrigin,
        messages: [{ role: "user", content: prompt }],
        turn: {
          content: prompt,
          userClientId: `sched-u-${run.id}`,
          assistantClientId: `sched-a-${run.id}`,
        },
        chatModel:
          task.model_mode === "thinking" ? env.thinkingModel : env.fastModel,
        extendedThinking: task.model_mode === "thinking",
        clientTimezone: task.timezone,
        generateChatTitle: false,
        requestId: run.id,
        turnStartedAtMs: Date.now(),
      },
    });
    return { runId, chatId, status: "running", jobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run.attempt_count >= 5) {
      await tasksRepo.completeScheduledRun({
        runId,
        status: "failed",
        attempt: run.attempt_count,
        summary: message,
        errorMessage: message,
      });
      return { runId, chatId: run.chat_id, status: "failed", jobId: null };
    }
    await tasksRepo.requeueScheduledTaskRun(runId, message, run.attempt_count);
    throw new AppError(message, 503);
  }
}

/** Reconcile durable results before claiming the next occurrence. */
export async function reconcileScheduledRuns(limit = 20) {
  const completions = await tasksRepo.listScheduledRunCompletions(limit);
  for (const { run, job_status, job_error, answer } of completions) {
    const success = job_status === "complete";
    const skipped = job_status === "cancelled";
    const summary =
      answer?.slice(0, 500) ||
      job_error ||
      (success
        ? "Your automation completed successfully."
        : job_status === "paused_for_user"
          ? "This task needs your input. Open the result chat to continue."
          : skipped
            ? "The run was stopped."
            : "Your automation failed.");
    await tasksRepo.completeScheduledRun({
      runId: run.id,
      status: success ? "success" : skipped ? "skipped" : "failed",
      summary,
      errorMessage: success || skipped ? null : (job_error ?? summary),
    });
  }
  const notifications = await tasksRepo.claimScheduledNotifications(
    Math.min(limit, 3),
  );
  await Promise.all(
    notifications.map(async ({ task, run }) => {
      try {
        await deliverRunNotification(
          task,
          run,
          run.summary ?? "Your automation finished.",
        );
        await tasksRepo.markScheduledNotificationDelivered(run.id);
      } catch (error) {
        console.error("[scheduled-tasks] notification delivery failed", {
          runId: run.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
  return completions.length;
}

/** Claim due schedules into durable queue jobs. No inference runs here. */
export async function dispatchDueScheduledTasks(limit = 8): Promise<{
  claimed: number;
  jobs: tasksRepo.QueuedScheduledRun[];
}> {
  await reconcileScheduledRuns(limit);
  const manual = await tasksRepo.claimQueuedScheduledRuns(limit);
  const due =
    manual.length < limit
      ? await tasksRepo.claimDueScheduledTasks(limit - manual.length)
      : [];
  const jobs = [...manual, ...due];
  return { claimed: jobs.length, jobs };
}

export async function runTaskNow(taskId: string, userId: string) {
  await getTask(taskId, userId);
  const run = await tasksRepo.queueManualScheduledRun(taskId, userId);
  if (!run)
    throw new AppError(
      "Enable the task and wait for any current run to finish before running it again.",
      409,
    );
  return { runId: run.id, status: "queued" };
}
