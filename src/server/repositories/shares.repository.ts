import { createHash, randomBytes, randomUUID } from "crypto";
import { env } from "@/server/config/env"; // trusted app origin — Host header spoofing avoid
import { queryOne } from "@/server/db/pool"; // parameterized single-row SQL
import { AppError } from "@/server/db/errors"; // invalid visibility → 400
import type { SharedChatSnapshot } from "@/lib/share-public";
import { sealShareToken } from "@/server/chat/share-token";
import {
  buildChatShareSnapshotKey,
  putJsonPayload,
  readJsonPayload,
} from "@/server/chat/message-payload-store";

const SHARE_VISIBILITIES = ["link", "workspace", "public"] as const;
type ShareVisibility = (typeof SHARE_VISIBILITIES)[number];

// conversation_shares row — metadata non-secret only; token hash is authoritative lookup
export type ConversationShareRow = {
  id: string; // share record UUID
  chat_id: string; // shared conversation
  user_id: string;
  visibility: string; // link | workspace | public — access policy hint
  created_at: string; // share creation time
  revoked_at: string | null; // null = active; timestamp = revoked
  metadata: Record<string, unknown>; // sealed token only — never the raw link secret
  share_token_hash: string;
  snapshot_object_key?: string | null;
};

function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function resolveShareVisibility(
  visibility: string | undefined,
): ShareVisibility {
  if (visibility == null) return "link";
  if ((SHARE_VISIBILITIES as readonly string[]).includes(visibility)) {
    return visibility as ShareVisibility;
  }
  throw new AppError("Invalid share visibility.", 400);
}

// share URL base — configured app origin only; reject Host-header spoofed origins
function trustedShareBaseUrl(requestedBaseUrl: string): string {
  const configured = env.appUrl.replace(/\/$/, "");
  try {
    const configuredOrigin = new URL(configured).origin;
    const requestedOrigin = new URL(requestedBaseUrl).origin;
    if (requestedOrigin === configuredOrigin) {
      return configured;
    }
  } catch {
    // malformed request origin — fall back to configured app URL
  }
  return configured;
}

export async function getActiveShareForChat(chatId: string, userId: string) {
  return queryOne<ConversationShareRow>(
    `select id, chat_id, user_id, visibility, created_at, revoked_at, metadata,
            share_token_hash
     from public.conversation_shares
     where chat_id = $1 and user_id = $2 and revoked_at is null
     order by created_at desc
     limit 1`,
    [chatId, userId],
  );
}

export async function createConversationShare(input: {
  userId: string;
  chatId: string;
  visibility?: "link" | "workspace" | "public";
  baseUrl: string;
  snapshot: SharedChatSnapshot;
}) {
  const token = randomBytes(24).toString("base64url"); // URL-safe high-entropy secret
  const shareTokenHash = hashShareToken(token);
  const sealedToken = sealShareToken(token);
  const visibility = resolveShareVisibility(input.visibility);
  const baseUrl = trustedShareBaseUrl(input.baseUrl);
  const shareId = randomUUID();

  // Snapshot objects are immutable and owner-scoped; Postgres keeps only the
  // pointer so shared conversations never duplicate bodies in the database.
  const snapshotKey = buildChatShareSnapshotKey(
    input.userId,
    input.chatId,
    shareId,
  );
  const snapshotRef = await putJsonPayload({
    key: snapshotKey,
    value: input.snapshot,
    metadata: {
      userId: input.userId,
      chatId: input.chatId,
      shareId,
      kind: "share-snapshot",
    },
  });

  const row = await queryOne<ConversationShareRow>(
    `insert into public.conversation_shares (
       id, chat_id, user_id, share_token_hash, visibility, metadata, snapshot,
       snapshot_object_key
     ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
     returning id, chat_id, user_id, visibility, created_at, revoked_at, metadata,
               share_token_hash, snapshot_object_key`,
    [
      shareId,
      input.chatId,
      input.userId,
      shareTokenHash,
      visibility,
      JSON.stringify({ sealedToken }),
      snapshotRef ? null : JSON.stringify(input.snapshot),
      snapshotRef?.key ?? null,
    ],
  );

  const shareUrl = `${baseUrl}/share/${token}`;
  return { share: row, shareUrl, token, shareTokenHash };
}

export async function revokeConversationShare(shareId: string, userId: string) {
  return queryOne<ConversationShareRow>(
    `update public.conversation_shares
     set revoked_at = now()
     where id = $1 and user_id = $2 and revoked_at is null
     returning id, chat_id, user_id, visibility, created_at, revoked_at, metadata,
               share_token_hash`,
    [shareId, userId],
  );
}

export async function getPublicShareSnapshot(token: string) {
  const shareTokenHash = hashShareToken(token);
  const row = await queryOne<{
    visibility: string;
    expires_at: string | null;
    snapshot: unknown;
    snapshot_object_key: string | null;
  }>(
    `select visibility, expires_at, snapshot, snapshot_object_key
     from public.conversation_shares
     where share_token_hash = $1 and revoked_at is null
     limit 1`,
    [shareTokenHash],
  );
  if (!row) return null;
  if (row.snapshot_object_key) {
    const snapshot = await readJsonPayload<unknown>(row.snapshot_object_key);
    if (snapshot) return { ...row, snapshot };
  }
  return row;
}

