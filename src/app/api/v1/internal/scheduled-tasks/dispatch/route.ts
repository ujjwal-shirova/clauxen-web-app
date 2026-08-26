import { NextRequest, NextResponse } from "next/server";
import { dispatchDueScheduledTasks } from "@/server/services/scheduled-tasks.service";
import { isScheduledTasksInternalRequest } from "@/server/http/internal-scheduled-tasks-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Cron entrypoint for Cloudflare Worker (or pg_cron HTTP).
 * Auth: Bearer / x-clauxen-internal with SCHEDULED_TASKS_INTERNAL_TOKEN.
 *
 * Returns durable queue jobs; it never executes agent turns itself.
 */
export async function POST(request: NextRequest) {
  if (!isScheduledTasksInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), 20)
    : 8;

  const result = await dispatchDueScheduledTasks(limit);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  // Health / manual poke with same auth
  return POST(request);
}
