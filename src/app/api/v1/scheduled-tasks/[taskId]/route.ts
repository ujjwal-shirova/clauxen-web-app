import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import * as scheduledTasks from "@/server/services/scheduled-tasks.service";
import * as tasksRepo from "@/server/repositories/scheduled-tasks.repository";
import type { ScheduleFrequency } from "@/server/services/scheduled-tasks-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ taskId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const task = await scheduledTasks.getTask(params.taskId, user.id);
    const runs = await tasksRepo.listRecentRuns(params.taskId, user.id, 20);
    return jsonData({ task, runs });
  },
  { requireAuth: true },
);

export const PATCH = withApiRouteParams<{ taskId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }

    const patch: Parameters<typeof scheduledTasks.updateTask>[2] = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.requirement === "string")
      patch.requirement = body.requirement;
    if (typeof body.frequency === "string") {
      patch.frequency = body.frequency as ScheduleFrequency;
    }
    if (typeof body.timeLocal === "string") patch.timeLocal = body.timeLocal;
    if (typeof body.time_local === "string") patch.timeLocal = body.time_local;
    if (typeof body.timezone === "string") patch.timezone = body.timezone;
    if (body.runDate !== undefined) {
      patch.runDate = typeof body.runDate === "string" ? body.runDate : null;
    }
    if (body.run_date !== undefined) {
      patch.runDate = typeof body.run_date === "string" ? body.run_date : null;
    }
    if (typeof body.dayOfWeek === "number") patch.dayOfWeek = body.dayOfWeek;
    if (typeof body.day_of_week === "number")
      patch.dayOfWeek = body.day_of_week;
    if (typeof body.dayOfMonth === "number") patch.dayOfMonth = body.dayOfMonth;
    if (typeof body.day_of_month === "number") {
      patch.dayOfMonth = body.day_of_month;
    }
    if (body.expiresAt !== undefined) {
      patch.expiresAt =
        typeof body.expiresAt === "string" ? body.expiresAt : null;
    }
    if (body.expires_at !== undefined) {
      patch.expiresAt =
        typeof body.expires_at === "string" ? body.expires_at : null;
    }
    if (body.status === "active" || body.status === "paused") {
      patch.status = body.status;
    }
    if (typeof body.notificationMode === "string") {
      patch.notificationMode = body.notificationMode as "email_app";
    }
    if (typeof body.modelMode === "string") {
      patch.modelMode = body.modelMode as "fast";
    }
    if (Array.isArray(body.skillIds)) {
      patch.skillIds = body.skillIds.filter(
        (value): value is string => typeof value === "string",
      );
    }
    if (Array.isArray(body.attachmentRefs)) {
      patch.attachmentRefs = body.attachmentRefs.filter(
        (value): value is Record<string, unknown> =>
          Boolean(value) && typeof value === "object" && !Array.isArray(value),
      );
    }

    const task = await scheduledTasks.updateTask(params.taskId, user.id, patch);
    return jsonData({ task });
  },
  { requireAuth: true },
);

export const DELETE = withApiRouteParams<{ taskId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    await scheduledTasks.deleteTask(params.taskId, user.id);
    return jsonData({ ok: true });
  },
  { requireAuth: true },
);
