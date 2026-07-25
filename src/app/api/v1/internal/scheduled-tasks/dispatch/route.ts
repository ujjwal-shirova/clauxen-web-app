import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { env } from "@/server/config/env";
import {
  dispatchDueScheduledTasks,
} from "@/server/services/scheduled-tasks.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

function isAuthorized(request: NextRequest): boolean {
  const token = env.scheduledTasksInternalToken?.trim();
  if (!token) return false;

  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ") && safeEqual(auth.slice(7).trim(), token)) {
    return true;
  }
  const header = request.headers.get("x-clauxen-internal") ?? "";
  return header.length > 0 && safeEqual(header.trim(), token);
}

/**
 * Cron entrypoint for Cloudflare Worker (or pg_cron HTTP).
 * Auth: Bearer / x-clauxen-internal with SCHEDULED_TASKS_INTERNAL_TOKEN.
 *
 * Query: ?async=1 — acknowledge immediately and finish in `after()`.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const asyncMode = url.searchParams.get("async") === "1";
  const limitRaw = Number(url.searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), 20)
    : 8;

  if (asyncMode) {
    after(() => {
      void dispatchDueScheduledTasks(limit).catch((err) => {
        console.error("[scheduled-tasks] async dispatch failed", err);
      });
    });
    return NextResponse.json({ ok: true, mode: "async", limit });
  }

  const result = await dispatchDueScheduledTasks(limit);
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  // Health / manual poke with same auth
  return POST(request);
}
