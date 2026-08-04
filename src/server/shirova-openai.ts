import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  env,
  requireOpenAIApiKey,
  optionalOpenAIBaseUrl,
} from "@/server/config/env";

function getAllowedGatewayKeys() {
  return [
    ...(process.env.SHIROVA_API_KEYS ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
    process.env.SHIROVA_GATEWAY_KEY?.trim() ?? "",
  ].filter(Boolean);
}

function authorizeGatewayRequest(request: Request) {
  const allowedKeys = getAllowedGatewayKeys();
  if (allowedKeys.length === 0) return false;
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const gatewayKey = request.headers.get("x-shirova-api-key")?.trim();
  return allowedKeys.some((key) => key === bearer || key === gatewayKey);
}

function createClient() {
  return new OpenAI({
    apiKey: requireOpenAIApiKey(),
    ...(optionalOpenAIBaseUrl()
      ? { baseURL: optionalOpenAIBaseUrl() }
      : {}),
  });
}

/** Proxies authenticated Shirova clients to OpenAI Responses. */
export async function handleShirovaResponsesPost(request: Request) {
  try {
    if (!authorizeGatewayRequest(request)) {
      return NextResponse.json(
        {
          error: {
            type: "authentication_error",
            message: "Unauthorized.",
          },
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as OpenAI.Responses.ResponseCreateParams;
    const client = createClient();
    const model = body.model || env.defaultModel;

    if (body.stream === true) {
      const upstream = await client.responses.create({
        ...body,
        model,
        stream: true,
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
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenAI gateway error.";
    console.error("Error while proxying Shirova OpenAI responses:", error);
    return NextResponse.json(
      { error: { type: "api_error", message } },
      { status: 500 },
    );
  }
}
