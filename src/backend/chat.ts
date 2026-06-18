import { NextResponse, type NextRequest } from "next/server";
import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { env } from "@/backend/config/env";
import { getSessionFromRequest } from "@/backend/auth/session";
import {
  legacyStreamFromMessages,
  sanitizeMessages,
} from "@/backend/services/chat.service";
import { generateOpenAiTitle } from "@/backend/inference/openai-stream";
import {
  resolveThinkingType,
  type IncomingMessage,
  type ThinkingType,
} from "@/backend/inference/novita";
import { resolveGenerateChatTitle } from "@/lib/chat-title";
import { logInferenceTelemetry } from "@/backend/telemetry/inference-log";
import { resolveRequestCountryCode } from "@/lib/request-geo";

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
      generateChatTitle?: boolean;
      chatModel?: string;
    };
    messages = sanitizeMessages(body?.messages);
    const thinkingType: ThinkingType = resolveThinkingType(body);
    const webSearchEnabled = body?.webSearchEnabled === true;
    const generateChatTitle = resolveGenerateChatTitle(
      messages,
      body?.generateChatTitle,
    );

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "At least one message is required." },
        { status: 400 },
      );
    }

    const stream = await legacyStreamFromMessages(messages, request.signal, {
      thinkingType,
      webSearchEnabled,
      userCountryCode: resolveRequestCountryCode(request.headers),
      generateChatTitle,
      chatModel: body?.chatModel,
    });

    return new Response(stream, {
      headers: {
        ...UI_MESSAGE_STREAM_HEADERS,
        "Cache-Control": "no-cache, no-transform",
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

    if (messages.length < 1) {
      return NextResponse.json(
        {
          error: "At least one user message is required to generate a title.",
        },
        { status: 400 },
      );
    }

    const title = await generateOpenAiTitle(messages, request.signal);
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
