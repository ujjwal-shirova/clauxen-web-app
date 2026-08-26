import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { env } from "@/server/config/env";

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function isScheduledTasksInternalRequest(request: NextRequest): boolean {
  const token = env.scheduledTasksInternalToken?.trim();
  if (!token) return false;
  const bearer = request.headers.get("authorization") ?? "";
  if (
    bearer.startsWith("Bearer ") &&
    safeEqual(bearer.slice(7).trim(), token)
  ) {
    return true;
  }
  const internal = request.headers.get("x-clauxen-internal")?.trim() ?? "";
  return Boolean(internal) && safeEqual(internal, token);
}
