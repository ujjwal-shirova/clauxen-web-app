import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/server/db/errors";
import { isScheduledTasksInternalRequest } from "@/server/http/internal-scheduled-tasks-auth";
import { executeScheduledRun } from "@/server/services/scheduled-tasks.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isScheduledTasksInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { runId?: unknown };
  try {
    body = (await request.json()) as { runId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      runId,
    )
  ) {
    return NextResponse.json(
      { error: "Valid runId required" },
      { status: 400 },
    );
  }
  try {
    const result = await executeScheduledRun(runId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Scheduled run failed";
    console.error("[scheduled-tasks] execute", { runId, status, message });
    return NextResponse.json({ error: message, runId }, { status });
  }
}
