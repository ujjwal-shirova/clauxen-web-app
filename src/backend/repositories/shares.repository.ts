import { createHash, randomBytes } from "crypto";
import { env } from "@/backend/config/env"; // trusted app origin — Host header spoofing avoid
import { queryOne } from "@/backend/db/pool"; // parameterized single-row SQL
import { AppError } from "@/backend/db/errors"; // invalid visibility → 400

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
  metadata: Record<string, unknown>; // extra JSON — must not store plaintext share tokens
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
    `select id, chat_id, user_id, visibility, created_at, revoked_at, metadata
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
}) {
  const token = randomBytes(24).toString("base64url"); // URL-safe high-entropy secret
  const shareTokenHash = hashShareToken(token);
  const visibility = resolveShareVisibility(input.visibility);
  const baseUrl = trustedShareBaseUrl(input.baseUrl);

  const row = await queryOne<ConversationShareRow>(
    `insert into public.conversation_shares (
       chat_id, user_id, share_token_hash, visibility, metadata
     ) values ($1, $2, $3, $4, $5::jsonb)
     returning id, chat_id, user_id, visibility, created_at, revoked_at, metadata`,
    [
      input.chatId, // $1 — shared chat id
      input.userId, // $2 — creator owner
      shareTokenHash, // $3 — hashed token for lookup/validation
      visibility, // $4 — validated visibility enum
      JSON.stringify({}), // $5 — no plaintext token in DB; hash is sole secret store
    ],
  );

  const shareUrl = `${baseUrl}/share/${token}`; // trusted origin only — open redirect blocked
  return { share: row, shareUrl, token };
}

export async function revokeConversationShare(shareId: string, userId: string) {
  return queryOne<ConversationShareRow>(
    `update public.conversation_shares
     set revoked_at = now()
     where id = $1 and user_id = $2 and revoked_at is null
     returning id, chat_id, user_id, visibility, created_at, revoked_at`,
    [shareId, userId],
  );
}

export async function getShareByToken(token: string) {
  const shareTokenHash = hashShareToken(token);
  return queryOne<
    ConversationShareRow & { share_token_hash: string; chat_title: string | null }
  >(
    `select cs.id, cs.chat_id, cs.user_id, cs.visibility, cs.created_at, cs.revoked_at, cs.metadata,
            c.title as chat_title
     from public.conversation_shares cs
     join public.chats c on c.id = cs.chat_id
     where cs.share_token_hash = $1 and cs.revoked_at is null
     limit 1`,
    [shareTokenHash],
  );
}
