import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  env,
  requireProviderApiKey,
  requireAnthropicBaseUrl,
} from "@/server/config/env";
import { getSessionFromRequest } from "@/server/auth/session";
import { getUserBalance, debitUserTokens } from "@/server/repositories/billing.repository";

function anthropicError(status: number, type: string, message: string) {
  return NextResponse.json(
    { type: "error", error: { type, message } },
    { status },
  );
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

/**
 * User-authenticated Anthropic Messages proxy for Clauxen Code CLI.
 * Novita/provider keys never leave the server.
 */
export async function handleCodeMessagesPost(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return anthropicError(401, "authentication_error", "Unauthorized.");
    }

    const balanceError = await assertUserCanInfer(session.id);
    if (balanceError) {
      return anthropicError(402, "permission_error", balanceError);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return anthropicError(400, "invalid_request_error", "Invalid JSON body.");
    }

    const model =
      (typeof body.model === "string" && body.model.trim()) ||
      env.defaultModel ||
      env.virgilModel;
    const stream = body.stream === true;

    const apiKey = requireProviderApiKey();
    const baseUrl = requireAnthropicBaseUrl().replace(/\/+$/, "");
    const upstreamUrl = `${baseUrl}/v1/messages`;

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "anthropic-version":
          request.headers.get("anthropic-version") || "2023-06-01",
        ...(request.headers.get("anthropic-beta")
          ? { "anthropic-beta": request.headers.get("anthropic-beta")! }
          : {}),
      },
      body: JSON.stringify({
        ...body,
        model,
      }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return new Response(text || JSON.stringify({
        type: "error",
        error: { type: "api_error", message: "Upstream inference failed." },
      }), {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
        },
      });
    }

    // Rough debit: prefer usage from non-stream JSON; for streams debit a minimum.
    if (!stream) {
      const cloned = upstream.clone();
      try {
        const json = (await cloned.json()) as {
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const inputTokens = json.usage?.input_tokens ?? 0;
        const outputTokens = json.usage?.output_tokens ?? 0;
        const amount = Math.max(1, outputTokens + Math.ceil(inputTokens / 10));
        await debitUserTokens({
          userId: session.id,
          amount,
          modelId: String(model),
          source: "clauxen_code",
          metadata: { path: "/api/v1/code/v1/messages" },
        }).catch((err) => {
          console.warn("[code-gateway] debit failed:", err);
        });
      } catch {
        /* ignore parse/debit failures for response delivery */
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") || "application/json",
        },
      });
    }

    // Streaming: debit a small reservation; detailed metering can refine later.
    void debitUserTokens({
      userId: session.id,
      amount: 1,
      modelId: String(model),
      source: "clauxen_code_stream",
      metadata: { path: "/api/v1/code/v1/messages", stream: true },
    }).catch((err) => {
      console.warn("[code-gateway] stream debit failed:", err);
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ||
          "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown code gateway error.";
    console.error("[code-gateway]", error);
    return anthropicError(500, "api_error", message);
  }
}
