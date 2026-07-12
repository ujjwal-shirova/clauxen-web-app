// Params: chatId — URL dynamic segment; user-scoped access only
// Use case: alternate reply paths (branching) UI — activePath + messages snapshot persist
// =============================================================================

import { withApiRouteParams } from "@/backend/http/route-params"; // [chatId] params inject + auth gates wrap
import { jsonData } from "@/backend/http/api-response"; // { data: … } success envelope
import { requireSession } from "@/backend/auth/require-session"; // null session → 401 AppError
import { AppError } from "@/backend/db/errors"; // validation errors — malformed body / oversized payload
import { sanitizeBranchMessages } from "@/backend/chat/sanitize-branch-messages";
import * as chatService from "@/backend/services/chat.service"; // branch state read/write — ownership check included

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BRANCH_ACTIVE_PATH_LEN = 256; // branch index depth cap — DoS guard on jsonb array
const MAX_BRANCH_STATE_JSON_BYTES = 2 * 1024 * 1024; // 2 MiB serialized cap — oversized tree reject

function sanitizeActivePath(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isInteger(value) && value >= 0,
    )
    .slice(0, MAX_BRANCH_ACTIVE_PATH_LEN);
}

function assertBranchPayloadSize(activePath: number[], messages: unknown) {
  const size = JSON.stringify({ activePath, messages }).length;
  if (size > MAX_BRANCH_STATE_JSON_BYTES) {
    throw new AppError("Branch state payload is too large.", 400);
  }
}

export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session); // authenticated user id — unauthenticated → reject
    const state = await chatService.getBranchState(params.chatId, user.id); // ownership verify + branch JSON load
    return jsonData({ state });
  },
  { requireAuth: true, requireChatAuth: true },
);

export const PUT = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    let body: { activePath?: unknown; messages?: unknown };
    try {
      body = (await request.json()) as {
        activePath?: unknown;
        messages?: unknown;
      };
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }
    const activePath = sanitizeActivePath(body.activePath); // non-array / invalid indices → []
    // Keep ids + agent frames — do NOT use sanitizeMessages (prompt-only stripper).
    const messages = sanitizeBranchMessages(body.messages);
    assertBranchPayloadSize(activePath, messages); // reject oversized jsonb writes
    const state = await chatService.saveBranchState(
      params.chatId,
      user.id,
      activePath,
      messages,
    ); // ownership check + upsert branch state row
    return jsonData({ state }); // saved state client state sync — optimistic UI confirm
  },
  { requireAuth: true, requireChatAuth: true },
);
