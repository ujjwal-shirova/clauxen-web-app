import { after, NextRequest, NextResponse } from "next/server";
import { isGenerationsInternalRequest } from "@/server/http/internal-generations-auth";
import {
  claimGenerationJob,
  getGenerationJob,
} from "@/server/repositories/generation-jobs.repository";
import { runHeadlessSlice } from "@/server/chat/durable-generation";
import { randomUUID } from "node:crypto";
import { cloudflareContext } from "@/server/cloudflare/context";
import { withDatabaseRequest } from "@/server/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Chains the next slice of a durable background generation.
 *
 * Cloudflare HTTP requests enqueue a slice and return 202. Queue consumers
 * await the complete slice; local Node development uses after(). Atomic
 * claiming returns 409 when another slice already owns the job.
 */
export function POST(request: NextRequest) {
  return withDatabaseRequest(() => execute(request));
}

async function execute(request: NextRequest) {
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
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      jobId,
    )
  ) {
    return NextResponse.json(
      { error: "A valid jobId is required" },
      { status: 400 },
    );
  }

  const cloudflare = cloudflareContext();
  if (cloudflare && request.headers.get("x-clauxen-queue-execution") !== "1") {
    await cloudflare.env.GENERATION_QUEUE.send({ jobId });
    return NextResponse.json(
      { ok: true, jobId, queued: true },
      { status: 202 },
    );
  }

  const worker = `continue-${cloudflare ? "cloudflare" : "local"}-${randomUUID().slice(0, 8)}`;
  const job = await claimGenerationJob(jobId, worker);
  if (!job) {
    const current = await getGenerationJob(jobId).catch(() => null);
    // Already terminal/cancelled, or another slice holds it — both fine.
    return NextResponse.json(
      { ok: false, status: current?.status ?? "unknown" },
      { status: 409 },
    );
  }

  const origin = job.input.executionOrigin ?? new URL(request.url).origin;
  if (cloudflare) {
    const result = await runHeadlessSlice({ job, origin });
    return NextResponse.json({ ok: true, jobId: job.id, ...result });
  }
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
