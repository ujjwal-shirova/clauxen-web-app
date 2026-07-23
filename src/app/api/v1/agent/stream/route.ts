import { withApiHandler } from "@/backend/http/api-handler";
import { createAgentSseStream } from "@/backend/inference/agent-stream";
import {
  sanitizeAgentMessages,
  type AgentChatRequest,
} from "@/backend/inference/novita-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withApiHandler(
  async ({ request, session }) => {
    const body = (await request.json()) as AgentChatRequest;
    const messages = sanitizeAgentMessages(body.messages);
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = createAgentSseStream({ ...body, messages }, request.signal, {
      userId: session?.id,
      conversationId: body.conversationId,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
  { requireAuth: true },
);
