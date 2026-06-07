import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import {
  runNovitaAgentChat,
  type AgentChatRequest,
} from "@/backend/inference/novita-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withApiHandler(
  async ({ request, session }) => {
    const body = (await request.json()) as AgentChatRequest;
    const result = await runNovitaAgentChat(body, request.signal, {
      userId: session?.id,
      conversationId: body.conversationId,
    });
    return jsonData(result);
  },
  { requireChatAuth: true },
);
