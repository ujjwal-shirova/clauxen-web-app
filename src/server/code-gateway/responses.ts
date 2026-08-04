import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  env,
  requireOpenAIApiKey,
  optionalOpenAIBaseUrl,
} from "@/server/config/env";
import { getSessionFromRequest } from "@/server/auth/session";
import {
  getUserBalance,
  debitUserTokens,
} from "@/server/repositories/billing.repository";

function apiError(status: number, type: string, message: string) {
  return NextResponse.json({ error: { type, message } }, { status });
}

async function assertUserCanInfer(userId: string): Promise<string | null> {
  const balance = await getUserBalance(userId);
  if (!balance) {
    return "No Clauxen balance found. Open clauxen.com to activate your account.";
  }
  if (balance.status === "suspended") {
    return "Your Clauxen account is suspended. Contact support or visit clauxen.com.";
  }
  if ((balance.tokens_remaining ?? 0) <= 0) {
    return "You're out of tokens. Upgrade or top up at clauxen.com.";
  }
  return null;
}

function createClient() {
  return new OpenAI({
    apiKey: requireOpenAIApiKey(),
    ...(optionalOpenAIBaseUrl()
      ? { baseURL: optionalOpenAIBaseUrl() }
      : {}),
  });
}

/** Clauxen Code authenticated gateway for the OpenAI Responses API. */
export async function handleCodeResponsesPost(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return apiError(
        401,
        "authentication_error",
        "Sign in with your Clauxen account or provide a clx_ API key.",
      );
    }
    const balanceError = await assertUserCanInfer(session.id);
    if (balanceError) return apiError(402, "permission_error", balanceError);

    let body: OpenAI.Responses.ResponseCreateParams;
    try {
      body = (await request.json()) as OpenAI.Responses.ResponseCreateParams;
    } catch {
      return apiError(400, "invalid_request_error", "Invalid JSON body.");
    }

    const client = createClient();
    const model = env.defaultModel || env.virgilModel;
    if (body.stream === true) {
      const upstream = await client.responses.create({
        ...body,
        model,
        stream: true,
      });
      void debitUserTokens({
        userId: session.id,
        amount: 1,
        modelId: String(model),
        source: "clauxen_code_stream",
        metadata: {
          path: "/api/v1/code/v1/responses",
          stream: true,
          upstream: "openai_responses",
        },
      }).catch((error) => {
        console.warn("[code-gateway] stream debit failed:", error);
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of upstream) {
              controller.enqueue(
                encoder.encode(
                  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
                ),
              );
            }
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  type: "error",
                  message:
                    error instanceof Error ? error.message : String(error),
                })}\n\n`,
              ),
            );
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const response = await client.responses.create({
      ...body,
      model,
      stream: false,
    });
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    await debitUserTokens({
      userId: session.id,
      amount: Math.max(1, outputTokens + Math.ceil(inputTokens / 10)),
      modelId: String(model),
      source: "clauxen_code",
      metadata: {
        path: "/api/v1/code/v1/responses",
        upstream: "openai_responses",
      },
    }).catch((error) => {
      console.warn("[code-gateway] debit failed:", error);
    });
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenAI gateway error.";
    console.error("[code-gateway]", error);
    return apiError(500, "api_error", message);
  }
}
