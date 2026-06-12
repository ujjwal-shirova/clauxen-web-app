import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/backend/config/env";
import { getSessionFromRequest } from "@/backend/auth/session";
import {
  legacyStreamFromMessages,
  sanitizeMessages,
} from "@/backend/services/chat.service";
import {
  generateAnthropicTitle,
  resolveThinkingType,
  type IncomingMessage,
  type ThinkingType,
} from "@/backend/inference/novita";
import { logInferenceTelemetry } from "@/backend/telemetry/inference-log";

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
      thinkingEnabled?: boolean;
      thinkingType?: string;
      webSearchEnabled?: boolean;
    };
    messages = sanitizeMessages(body?.messages);
    const thinkingType: ThinkingType = resolveThinkingType(body);
    const webSearchEnabled = body?.webSearchEnabled === true;

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "At least one message is required." },
        { status: 400 },
      );
    }

    const stream = await legacyStreamFromMessages(messages, request.signal, {
      thinkingType,
      webSearchEnabled,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error while calling Shirova inference:", error);
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

export async function handleChatTitlePost(request: Request) {
  const startedAt = Date.now();
  let messages: IncomingMessage[] = [];

  try {
    const auth = await requireChatSession(request);
    if ("error" in auth) return auth.error;

    const body = await request.json();
    messages = sanitizeMessages(body?.messages).slice(0, 2);

    if (messages.length < 2) {
      return NextResponse.json(
        {
          error:
            "First user and assistant messages are required to generate a title.",
        },
        { status: 400 },
      );
    }

    const title = await generateAnthropicTitle(messages);
    await logInferenceTelemetry({
      userId: auth.session?.id ?? null,
      mode: "title",
      status: "success",
      model: env.defaultModel,
      messageCount: messages.length,
      responseCharacterCount: title.length,
      latencyMs: Date.now() - startedAt,
    });

    return NextResponse.json({ title });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error while generating chat title:", error);
    await logInferenceTelemetry({
      userId: null,
      mode: "title",
      status: "error",
      model: env.defaultModel,
      messageCount: messages.length,
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
