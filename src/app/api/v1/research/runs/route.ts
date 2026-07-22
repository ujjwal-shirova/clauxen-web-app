// Auth: requireAuth — user-scoped runs; POST objective required
// =============================================================================

import { randomUUID } from "crypto";
import { withApiHandler } from "@/backend/http/api-handler"; // collection route handler wrapper
import { jsonData } from "@/backend/http/api-response"; // JSON response helper; 201 on create
import { requireSession } from "@/backend/auth/require-session"; // session → user.id owner binding
import { isAcceptableChatId } from "@/backend/http/chat-id";
import * as chatsRepo from "@/backend/repositories/chats.repository"; // chat ownership verify — linked chatId IDOR guard
import * as researchRepo from "@/backend/repositories/research.repository"; // listResearchRuns / createResearchRun
import { AppError, notFound } from "@/backend/db/errors"; // 400 validation — missing objective; 404 foreign chat

const MAX_RESEARCH_OBJECTIVE_LENGTH = 16_384; // align with use-research client cap — server-side DoS guard
const RESEARCH_PROCESSOR_RE =
  /^(lite|base|core|core2x|pro|ultra|ultra2x|ultra4x|ultra8x)(-fast)?$/; // Parallel Task API processor allowlist

export const runtime = "nodejs"; // DB + crypto — Node.js runtime
export const dynamic = "force-dynamic"; // run list/status changes frequently

export const GET = withApiHandler(
  async ({ session }) => {
    // authenticated owner — list query user_id filter
    const user = requireSession(session);
    // listResearchRuns — order by created_at desc; agent swarm history UI feed
    const runs = await researchRepo.listResearchRuns(user.id);
    return jsonData({ runs });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    // session owner — insert row user_id column
    const user = requireSession(session);
    let body: { objective?: unknown; processor?: unknown; chatId?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      throw new AppError("Invalid JSON body.", 400);
    }
    const objectiveRaw =
      typeof body.objective === "string" ? body.objective.trim() : "";
    if (!objectiveRaw) {
      throw new AppError("objective is required.", 400);
    }
    if (objectiveRaw.length > MAX_RESEARCH_OBJECTIVE_LENGTH) {
      throw new AppError("objective is too long.", 413, "payload_too_large");
    }

    const processorRaw =
      typeof body.processor === "string" ? body.processor.trim() : "base";
    if (!RESEARCH_PROCESSOR_RE.test(processorRaw)) {
      throw new AppError("Invalid processor.", 400);
    }

    let linkedChatId: string | null = null;
    if (body.chatId != null && body.chatId !== "") {
      if (
        typeof body.chatId !== "string" ||
        !isAcceptableChatId(body.chatId.trim())
      ) {
        throw new AppError("Invalid chatId.", 400);
      }
      const chatId = body.chatId.trim();
      const chat = await chatsRepo.getChatForUser(chatId, user.id);
      if (!chat) throw notFound("Chat not found.");
      linkedChatId = chatId;
    }

    // createResearchRun — insert queued row; provider 'parallel' fixed in SQL
    const run = await researchRepo.createResearchRun({
      userId: user.id,
      objective: objectiveRaw,
      providerRunId: randomUUID(), // unique external correlation id — webhook matching
      processor: processorRaw, // validated Parallel processor tier
      chatId: linkedChatId, // null = standalone research; owner-verified chat link only
    });

    return jsonData({ run }, 201);
  },
  { requireAuth: true },
);
