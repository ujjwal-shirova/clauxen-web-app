import type { NextRequest } from "next/server";

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
