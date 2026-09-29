import { after, NextRequest, NextResponse } from "next/server";
import { isGenerationsInternalRequest } from "@/server/http/internal-generations-auth";
import {
  claimGenerationJob,
  getGenerationJob,
} from "@/server/repositories/generation-jobs.repository";
import { runHeadlessSlice } from "@/server/chat/durable-generation";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Chains the next slice of a durable background generation.
 *
 * Answers 202 immediately and runs the slice in after() — the triggering
 * slice (or the watchdog) never waits on model work. Claiming is atomic:
 * concurrent triggers for the same job 409, exactly one slice runs.
 */
export async function POST(request: NextRequest) {
  if (!isGenerationsInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: unknown };
  try {
    body = (await request.json()) as { jobId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const worker = `continue-${process.env.VERCEL_REGION ?? "local"}-${randomUUID().slice(0, 8)}`;
  const job = await claimGenerationJob(jobId, worker);
  if (!job) {
    const current = await getGenerationJob(jobId).catch(() => null);
    // Already terminal/cancelled, or another slice holds it — both fine.
    return NextResponse.json(
      { ok: false, status: current?.status ?? "unknown" },
      { status: 409 },
    );
  }

  const origin = new URL(request.url).origin;
  after(() =>
    runHeadlessSlice({ job, origin }).catch((error) => {
      console.error("[generations/continue] slice failed:", error);
    }),
  );
  return NextResponse.json(
    { ok: true, jobId: job.id, slice: job.slice_index },
    { status: 202 },
  );
}
