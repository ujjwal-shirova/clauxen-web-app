import { NextResponse } from "next/server";
import { env, requireNovitaApiKey } from "@/server/config/env";

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

async function readUpstreamError(response: Response) {
  try {
    return await response.text();
  } catch {
    return JSON.stringify({ error: "Novita Anthropic request failed." });
  }
}

/** Proxies authenticated Shirova clients to Novita's Anthropic Messages API. */
export async function handleShirovaMessagesPost(request: Request) {
  try {
    if (!authorizeGatewayRequest(request)) {
      return NextResponse.json(
        {
          type: "error",
          error: { type: "authentication_error", message: "Unauthorized." },
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const apiKey = requireNovitaApiKey();
    const upstream = await fetch(`${env.novitaOpenAiBaseUrl.replace(/\/+$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        model: body?.model || env.defaultModel,
      }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new Response(await readUpstreamError(upstream), {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
        },
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ||
          (body?.stream
            ? "text/event-stream; charset=utf-8"
            : "application/json"),
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown Shirova gateway error.";
    console.error("Error while proxying Shirova Anthropic messages:", error);
    return NextResponse.json(
      {
        type: "error",
        error: { type: "api_error", message },
      },
      { status: 500 },
    );
  }
}
