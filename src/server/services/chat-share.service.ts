import { env } from "@/server/config/env";
import { AppError, notFound } from "@/server/db/errors";
import * as chatsRepo from "@/server/repositories/chats.repository";
import * as messagesRepo from "@/server/repositories/messages.repository";
import * as sharesRepo from "@/server/repositories/shares.repository";
import { buildShareSnapshot } from "@/server/chat/share-snapshot";
import { openShareToken } from "@/server/chat/share-token";
import {
  publishShareToWorker,
  revokeShareOnWorker,
} from "@/server/chat/share-worker-client";
import {
  clientIpFromRequest,
  verifyShareTurnstile,
} from "@/server/chat/turnstile";
import {
  isAutomatedShareAgent,
  isShareToken,
  parseShareSnapshot,
} from "@/lib/share-public";

function shareBaseUrl() {
  return env.appUrl.replace(/\/$/, "");
}

function sealedTokenFromMetadata(metadata: Record<string, unknown>): string | null {
  const sealed = metadata.sealedToken;
  return typeof sealed === "string" && sealed.length > 0 ? sealed : null;
}

function urlForToken(token: string) {
  return `${shareBaseUrl()}/share/${token}`;
}

export async function readShareState(userId: string, chatId: string) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");

  const share = await sharesRepo.getActiveShareForChat(chatId, userId);
  if (!share) {
    return { share: null, shareUrl: null, visibility: "private" as const };
  }

  const sealed = sealedTokenFromMetadata(share.metadata);
  const token = sealed ? openShareToken(sealed) : null;
  return {
    share: { id: share.id, visibility: share.visibility },
    shareUrl: token ? urlForToken(token) : null,
    visibility: token ? share.visibility : "private",
  };
}

export async function publishShareLink(userId: string, chatId: string) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");

  const existing = await sharesRepo.getActiveShareForChat(chatId, userId);
  if (existing) {
    const sealed = sealedTokenFromMetadata(existing.metadata);
    const token = sealed ? openShareToken(sealed) : null;
    if (token) {
      return {
        share: { id: existing.id, visibility: existing.visibility },
        shareUrl: urlForToken(token),
        visibility: existing.visibility,
      };
    }
    await sharesRepo.revokeConversationShare(existing.id, userId);
    await revokeShareOnWorker(existing.share_token_hash);
  }

  const messages = await messagesRepo.listMessagesForChat(chatId);
  const snapshot = buildShareSnapshot({ title: chat.title, messages });
  const created = await sharesRepo.createConversationShare({
    userId,
    chatId,
    visibility: "link",
    baseUrl: shareBaseUrl(),
    snapshot,
  });
  if (!created.share) throw notFound("Unable to create share link.");

  const published = await publishShareToWorker({
    tokenHash: created.shareTokenHash,
    snapshot,
  });
  if (env.shareWorkerUrl && env.shareWorkerInternalToken && !published) {
    await sharesRepo.revokeConversationShare(created.share.id, userId);
    await revokeShareOnWorker(created.shareTokenHash);
    throw new AppError(
      "Could not publish the share link. Try again.",
      503,
      "share_publish_failed",
    );
  }

  return {
    share: { id: created.share.id, visibility: created.share.visibility },
    shareUrl: created.shareUrl,
    visibility: created.share.visibility,
  };
}

export async function revokeShareLink(userId: string, chatId: string) {
  const chat = await chatsRepo.getChatForUser(chatId, userId);
  if (!chat) throw notFound("Chat not found.");

  const existing = await sharesRepo.getActiveShareForChat(chatId, userId);
  if (existing) {
    await sharesRepo.revokeConversationShare(existing.id, userId);
    await revokeShareOnWorker(existing.share_token_hash);
  }
  return { share: null, shareUrl: null, visibility: "private" as const };
}

export async function openSharedChat(request: Request, token: string) {
  if (isAutomatedShareAgent(request.headers.get("user-agent"))) {
    throw new AppError(
      "This link cannot be opened by an automated client.",
      403,
      "share_bot_blocked",
    );
  }
  if (!isShareToken(token)) throw notFound("Share link not found or revoked.");

  const body = (await request.json().catch(() => null)) as {
    turnstileToken?: unknown;
  } | null;
  const turnstileToken =
    typeof body?.turnstileToken === "string" ? body.turnstileToken : "";

  const host = request.headers.get("x-forwarded-host")
    ?? request.headers.get("host")
    ?? "";
  await verifyShareTurnstile({
    token: turnstileToken,
    ip: clientIpFromRequest(request),
    requestHost: host,
  });

  const row = await sharesRepo.getPublicShareSnapshot(token);
  if (!row || (row.visibility !== "link" && row.visibility !== "public")) {
    throw notFound("Share link not found or revoked.");
  }
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
    throw notFound("Share link not found or revoked.");
  }

  const snapshot = parseShareSnapshot(row.snapshot);
  if (!snapshot) throw notFound("Share link not found or revoked.");
  return snapshot;
}
