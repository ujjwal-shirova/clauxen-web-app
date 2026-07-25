import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import * as scheduledTasks from "@/server/services/scheduled-tasks.service";
import type { ScheduleFrequency } from "@/server/services/scheduled-tasks-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const tasks = await scheduledTasks.listTasks(user.id);
    return jsonData({ tasks });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }

    const task = await scheduledTasks.createTask(user.id, {
      name: typeof body.name === "string" ? body.name : "",
      requirement: typeof body.requirement === "string" ? body.requirement : "",
      frequency: body.frequency as ScheduleFrequency,
      timeLocal:
        typeof body.timeLocal === "string"
          ? body.timeLocal
          : typeof body.time_local === "string"
            ? body.time_local
            : "",
      timezone:
        typeof body.timezone === "string"
          ? body.timezone
          : Intl.DateTimeFormat().resolvedOptions().timeZone,
      runDate:
        typeof body.runDate === "string"
          ? body.runDate
          : typeof body.run_date === "string"
            ? body.run_date
            : null,
      dayOfWeek:
        typeof body.dayOfWeek === "number"
          ? body.dayOfWeek
          : typeof body.day_of_week === "number"
            ? body.day_of_week
            : null,
      dayOfMonth:
        typeof body.dayOfMonth === "number"
          ? body.dayOfMonth
          : typeof body.day_of_month === "number"
            ? body.day_of_month
            : null,
      expiresAt:
        typeof body.expiresAt === "string"
          ? body.expiresAt
          : typeof body.expires_at === "string"
            ? body.expires_at
            : null,
      source: body.source === "chat" ? "chat" : "manual",
    });

    return jsonData({ task }, 201);
  },
  { requireAuth: true },
);
