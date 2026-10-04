import { NextRequest, NextResponse } from "next/server";
import { isGenerationsInternalRequest } from "@/server/http/internal-generations-auth";
import { recoverStalledJobs } from "@/server/chat/durable-generation";
import { query } from "@/server/db/pool";
import { settleOrphanedStreamingMessages } from "@/server/repositories/messages.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Watchdog: chains a replacement slice for every stalled background job.
 *
 * A job stalls when its slice dies without yielding (killed invocation,
 * crashed isolate, lost trigger) — detected via a stale heartbeat. The
 * replacement resumes from the last Postgres checkpoint, so no turn is ever
 * lost to infrastructure.
 *
 * Driven every minute by the Cloudflare `clauxen-generations-watchdog`
 * worker (see workers/generations-watchdog) — per-minute Vercel crons need
 * a paid plan. POST is the scheduled poke; GET is the manual poke with the
 * same auth. The watchdog only triggers /continue (202s); it never runs
 * model work itself, so one pass always fits in its 60s budget.
 */
async function run(request: NextRequest) {
  if (!isGenerationsInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), 25)
    : 10;
  const recovered = await recoverStalledJobs(url.origin, limit);
  // Orphaned 'streaming' rows (no live job) are settled here — never on the
  // chat read path.
  const orphansSettled = await settleOrphanedStreamingMessages().catch(
    (error: unknown) => {
      console.error("[watchdog] orphan sweep failed:", error);
      return 0;
    },
  );
  const result = { ...recovered, orphansSettled };
  // Liveness signal: one tiny upsert per poke, best-effort, never blocks.
  const source = (url.searchParams.get("source") ?? "manual")
    .trim()
    .slice(0, 32)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "") || "manual";
  void query(
    `insert into private.watchdog_heartbeats (source, last_poke_at, last_result)
     values ($1, now(), $2::jsonb)
     on conflict (source) do update
     set last_poke_at = now(), last_result = excluded.last_result`,
    [source, JSON.stringify(result)],
  ).catch(() => undefined);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
