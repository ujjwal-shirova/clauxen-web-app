import { NextRequest, NextResponse } from "next/server";
import { isGenerationsInternalRequest } from "@/server/http/internal-generations-auth";
import { recoverStalledJobs } from "@/server/chat/durable-generation";

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
 * Driven every minute by pg_cron + pg_net (see
 * supabase/migrations/20260929130000_generations_watchdog_cron.sql) — the
 * Vercel plan here only allows daily crons, which would stall recovery for
 * up to a day. POST is the scheduled poke; GET is the manual poke with the
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
  const result = await recoverStalledJobs(url.origin, limit);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
