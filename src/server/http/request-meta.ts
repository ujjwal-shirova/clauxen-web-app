import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

/** Preserve a trusted proxy/client correlation id, or issue a safe new one. */
export function requestId(request: NextRequest): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER)?.trim() ?? "";
  if (/^[A-Za-z0-9._:-]{8,128}$/.test(incoming)) return incoming;
  return randomUUID();
}

export function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export function clientUserAgent(request: NextRequest): string | null {
  return request.headers.get("user-agent");
}
