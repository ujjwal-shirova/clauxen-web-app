import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import * as chatService from "@/server/services/chat.service";
import {
  TRANSCRIPT_SCHEMA_VERSION,
  type TranscriptMessageRecord,
  type TranscriptRecord,
} from "@/server/training/transcript-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTranscriptJsonl(jsonl: string): TranscriptRecord[] {
  return jsonl
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as TranscriptRecord];
      } catch {
        return [];
      }
    });
}

function isMessageRecord(
  record: TranscriptRecord,
): record is TranscriptMessageRecord {
  return "role" in record && Boolean(record.message);
}

/**
 * Export a chat as JSONL for training / inspection.
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
      const records = parseTranscriptJsonl(transcript.jsonl ?? "");
      const messages = records.filter(isMessageRecord);
      return Response.json({
        chatId: transcript.chat_id,
        title: transcript.chat_title,
        lineCount: transcript.line_count,
        trainingEligible: transcript.training_eligible,
        schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
        messages,
        trainingMessages: messages.map((record) => ({
          role: record.role,
          content: record.message.content,
        })),
        events: records,
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
