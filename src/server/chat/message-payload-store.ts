import { createHash } from "node:crypto";
import {
  deleteObject,
  getObject,
  putObject,
} from "@/server/storage/object-store";

/**
 * Conversation bodies live in R2. Supabase keeps only ownership, tree
 * position, status, previews and search lexemes. Keys are stable so retries
 * overwrite the same object instead of leaving orphan copies.
 */

const CHAT_PAYLOAD_PURPOSE = "chat-archives" as const;

export type StoredJsonRef = {
  key: string;
  sha256: string;
  byteSize: number;
};

export type MessagePayload = {
  version: 1;
  messageId: string;
  chatId: string;
  userId: string;
  role: string;
  status: string;
  content: string;
  contentJson: Record<string, unknown>;
  savedAt: string;
};

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildChatMessagePayloadKey(
  userId: string,
  chatId: string,
  messageId: string,
) {
  return `users/${safeSegment(userId)}/chats/${safeSegment(chatId)}/messages/${safeSegment(messageId)}.json`;
}

export function buildChatJobPayloadKey(
  userId: string,
  jobId: string,
  kind: "input" | "checkpoint",
) {
  return `users/${safeSegment(userId)}/chats/jobs/${safeSegment(jobId)}/${kind}.json`;
}

export function buildChatShareSnapshotKey(
  userId: string,
  chatId: string,
  shareId: string,
) {
  return `users/${safeSegment(userId)}/chats/${safeSegment(chatId)}/shares/${safeSegment(shareId)}.json`;
}

function hashJson(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export async function putJsonPayload(input: {
  key: string;
  value: unknown;
  metadata?: Record<string, string>;
}): Promise<StoredJsonRef | null> {
  const body = JSON.stringify(input.value);
  const ref = await putObject({
    purpose: CHAT_PAYLOAD_PURPOSE,
    key: input.key,
    body,
    contentType: "application/json; charset=utf-8",
    metadata: input.metadata,
  });
  return {
    key: input.key,
    sha256: ref.contentHash ?? hashJson(input.value),
    byteSize: Buffer.byteLength(body, "utf8"),
  };
}

export async function readJsonPayload<T>(key: string): Promise<T | null> {
  try {
    const raw = await getObject(CHAT_PAYLOAD_PURPOSE, key);
    return JSON.parse(raw.toString("utf8")) as T;
  } catch (error) {
    console.warn("[chat-payload] Could not read R2 object", { key, error });
    return null;
  }
}

export async function deleteJsonPayload(key: string): Promise<void> {
  try {
    await deleteObject(CHAT_PAYLOAD_PURPOSE, key);
  } catch (error) {
    console.warn("[chat-payload] Could not delete R2 object", { key, error });
  }
}

export async function storeMessagePayload(input: {
  userId: string;
  chatId: string;
  messageId: string;
  role: string;
  status: string;
  content: string;
  contentJson: Record<string, unknown>;
}): Promise<StoredJsonRef | null> {
  const payload: MessagePayload = {
    version: 1,
    messageId: input.messageId,
    chatId: input.chatId,
    userId: input.userId,
    role: input.role,
    status: input.status,
    content: input.content,
    contentJson: input.contentJson,
    savedAt: new Date().toISOString(),
  };
  return putJsonPayload({
    key: buildChatMessagePayloadKey(
      input.userId,
      input.chatId,
      input.messageId,
    ),
    value: payload,
    metadata: {
      userId: input.userId,
      chatId: input.chatId,
      messageId: input.messageId,
    },
  });
}

const PAYLOAD_CACHE_MAX = 500;
const PAYLOAD_CACHE_TTL_MS = 5 * 60_000;
const payloadCache = new Map<
  string,
  { value: MessagePayload; at: number }
>();

/** Bounded, short-lived cache: page loads and prompt builds often re-read the
 * same turns within a few seconds. */
export async function readMessagePayload(
  key: string,
): Promise<MessagePayload | null> {
  const cached = payloadCache.get(key);
  if (cached && Date.now() - cached.at < PAYLOAD_CACHE_TTL_MS) {
    return cached.value;
  }
  const payload = await readJsonPayload<MessagePayload>(key);
  if (!payload) return null;
  payloadCache.set(key, { value: payload, at: Date.now() });
  if (payloadCache.size > PAYLOAD_CACHE_MAX) {
    const oldest = payloadCache.keys().next().value;
    if (oldest) payloadCache.delete(oldest);
  }
  return payload;
}
