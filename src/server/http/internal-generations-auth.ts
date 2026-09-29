import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { env } from "@/server/config/env";

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function generationsTokens(): string[] {
  return [
    env.generationsInternalToken,
    // Zero-config fallback: the chat-coord secret is already shared between
    // Vercel and Cloudflare on every environment.
    env.chatCoordInternalToken,
    env.scheduledTasksInternalToken,
  ]
    .map((token) => token?.trim() ?? "")
    .filter(Boolean);
}

/**
 * Auth for the durable-generation internal endpoints (/continue, /watchdog).
 * Accepts the generations token (or the shared coord/scheduler secret) via
 * `x-clauxen-internal` / Bearer. The Cloudflare watchdog worker and the
 * app's own continuation triggers both authenticate this way.
 */
export function isGenerationsInternalRequest(request: NextRequest): boolean {
  const header =
    request.headers.get("x-clauxen-internal")?.trim() ?? "";
  const bearer = request.headers.get("authorization") ?? "";
  const bearerToken = bearer.startsWith("Bearer ")
    ? bearer.slice(7).trim()
    : "";

  for (const token of generationsTokens()) {
    if (header && safeEqual(header, token)) return true;
    if (bearerToken && safeEqual(bearerToken, token)) return true;
  }
  return false;
}

/** Token the app uses when it triggers its own continuation endpoint. */
export function generationsTriggerToken(): string {
  return generationsTokens()[0] ?? "";
}
