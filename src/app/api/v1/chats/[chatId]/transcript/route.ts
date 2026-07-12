import { withApiRouteParams } from "@/backend/http/route-params";
import { requireSession } from "@/backend/auth/require-session";
import * as chatService from "@/backend/services/chat.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export a chat as Cursor-style JSONL for training / inspection.
 * GET /api/v1/chats/[chatId]/transcript?format=jsonl|json
 */
export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const transcript = await chatService.getChatTranscript(
      params.chatId,
      user.id,
    );
    const format =
      new URL(request.url).searchParams.get("format")?.toLowerCase() ?? "jsonl";

    if (format === "json") {
      return Response.json({
        chatId: transcript.chat_id,
        title: transcript.chat_title,
        lineCount: transcript.line_count,
        trainingEligible: transcript.training_eligible,
        schemaVersion: "clauxen.transcript.v1",
        jsonl: transcript.jsonl,
      });
    }

    return new Response(transcript.jsonl ?? "", {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="chat-${params.chatId}.jsonl"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { requireAuth: true, requireChatAuth: true },
);
