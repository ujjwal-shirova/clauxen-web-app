import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/backend/config/env";
import { getSessionFromRequest } from "@/backend/auth/session";
import {
  sanitizeMessages,
  type IncomingMessage,
} from "@/backend/inference/novita";
import { resolveGenerateChatTitle } from "@/lib/chat-title";
import { logInferenceTelemetry } from "@/backend/telemetry/inference-log";
import { resolveRequestCountryCode } from "@/lib/request-geo";
import { parseHomerReasoningEffort } from "@/lib/model-effort";
import { resolveModelRuntime, parseChatModelId, modelCatalogEnvFromProcess } from "@/lib/model-catalog";
import {
  runAutonomousAgent,
  generateChatTitle,
  type AgentStreamOptions,
} from "@/backend/inference/agent-engine";
import {
  ClauxenSseStream,
  CLAUXEN_STREAM_HEADERS,
} from "@/backend/inference/clauxen-sse-stream";
import { buildModelSystemPrompt } from "@/backend/inference/system-prompt";

async function requireChatSession(request: Request) {
  const session = await getSessionFromRequest(request as NextRequest);
  if (env.authRequiredForChat && !session) {
    return {
      error: NextResponse.json(
        { error: "Authentication required for chat." },
        { status: 401 },
      ),
    };
  }
  return { session };
}

export async function handleChatPost(request: Request) {
  const startedAt = Date.now();
  let messages: IncomingMessage[] = [];

  try {
    const auth = await requireChatSession(request);
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      messages?: unknown;
      generateChatTitle?: boolean;
      chatModel?: string;
      conversationId?: string;
      homerReasoningEffort?: string;
    };
    messages = sanitizeMessages(body?.messages);
    const conversationId = body?.conversationId;

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "At least one message is required." },
        { status: 400 },
      );
    }

    // Resolve model runtime from catalog
    const catalogEnv = modelCatalogEnvFromProcess();
    const chatModelId = parseChatModelId(body?.chatModel);
    const runtime = resolveModelRuntime(chatModelId, catalogEnv);

    const homerReasoningEffort = parseHomerReasoningEffort(body?.homerReasoningEffort);

    // Build the system prompt from the model's .md file (helios.md, homor.md, etc.)
    // Kept unchanged — this is the large authored prompt.
    const systemPrompt = buildModelSystemPrompt({
      model: chatModelId,
      append: undefined,
    });

    // Build agent stream options
    const agentOptions: AgentStreamOptions = {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      model: runtime.modelSlug,
      chatModelId,
      homerReasoningEffort,
      userId: auth.session?.id,
      conversationId,
      userCountryCode: resolveRequestCountryCode(request.headers),
      signal: request.signal,
      systemPrompt,
      temperature: 0.6,
      maxTokens: 8192,
    };

    const sse = new ClauxenSseStream();

    // Always run the autonomous agent — tools are always armed and the model
    // decides on its own whether/when to call them. Turns that need no tools
    // stream a plain answer with no frame overhead.
    void runAutonomousAgent(sse, agentOptions);

    return new Response(sse.stream, {
      headers: {
        ...CLAUXEN_STREAM_HEADERS,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error while calling Clauxen inference:", error);
    await logInferenceTelemetry({
      userId: null,
      mode: "chat",
      status: "error",
      model: env.defaultModel,
      messageCount: messages.length,
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/chat/title — non-streaming title generation. */
export async function handleChatTitlePost(request: Request) {
  try {
    const auth = await requireChatSession(request);
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      messages?: unknown;
      thinkingEnabled?: boolean;
    };
    const messages = sanitizeMessages(body?.messages);
    if (messages.length === 0) {
      return NextResponse.json(
        { error: "At least one message is required." },
        { status: 400 },
      );
    }

    const title = await generateChatTitle(
      messages.map((m) => ({ role: m.role, content: m.content })),
      request.signal,
    );

    return NextResponse.json({ title });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Title generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
