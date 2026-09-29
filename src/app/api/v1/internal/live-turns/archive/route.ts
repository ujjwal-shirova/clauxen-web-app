import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/server/config/env";
import * as messagesRepo from "@/server/repositories/messages.repository";
import * as chatsRepo from "@/server/repositories/chats.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const token = env.chatCoordInternalToken?.trim();
  if (!token) return false;
  const provided = request.headers.get("x-clauxen-internal")?.trim() ?? "";
  const left = Buffer.from(provided);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Cloudflare calls this 24 hours after a turn finishes. The live trace has
 * been served from the Durable Object until then.
 *
 * Durable turns already finalize to Postgres the moment they end, so this is
 * an idempotent backfill: terminal rows are never overwritten, and a turn
 * that somehow missed its finalize (pre-durable history, partial outage)
 * still lands exactly once.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    chatId?: unknown;
    userId?: unknown;
    assistantId?: unknown;
    status?: unknown;
    answer?: unknown;
    contentJson?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const assistantId =
    typeof body.assistantId === "string" ? body.assistantId.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer : "";
  const status =
    body.status === "failed" || body.status === "cancelled"
      ? body.status
      : "complete";
  const contentJson =
    body.contentJson && typeof body.contentJson === "object"
      ? (body.contentJson as Record<string, unknown>)
      : undefined;

  if (!chatId || !userId || !assistantId) {
    return NextResponse.json({ error: "Invalid turn" }, { status: 400 });
  }

  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const recent = await messagesRepo.listRecentMessagesForChat(chatId, 40);
  const existing = recent.find((row) => row.id === assistantId);
  // Terminal rows win: the durable finalize already wrote the authoritative
  // transcript. Only backfill streaming/queued rows that missed it.
  if (
    existing &&
    (existing.status === "complete" ||
      existing.status === "failed" ||
      existing.status === "cancelled")
  ) {
    await chatsRepo.setChatGenerating(chatId, userId, false);
    return NextResponse.json({ ok: true, deduped: true });
  }

  await messagesRepo.updateMessageContent(
    assistantId,
    chatId,
    answer,
    status,
    contentJson,
  );
  await chatsRepo.setChatGenerating(chatId, userId, false);
  return NextResponse.json({ ok: true });
}
