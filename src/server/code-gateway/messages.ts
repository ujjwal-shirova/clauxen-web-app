import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  env,
  requireProviderApiKey,
  requireAnthropicBaseUrl,
} from "@/server/config/env";
import { getSessionFromRequest } from "@/server/auth/session";
import {
  getUserBalance,
  debitUserTokens,
} from "@/server/repositories/billing.repository";
import { novitaFetch } from "@/server/inference/novita-fetch";

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
 * Clauxen Code CLI → Vercel gateway → Novita Anthropic Messages API.
 *
 * Auth: Supabase-backed Clauxen account via OAuth access token (`cla_at_…`)
 * or Settings API key (`clx_…`). Provider_API_Key never leaves the server
 * (Vercel env). Wire format stays Anthropic `/v1/messages`.
 */
export async function handleCodeMessagesPost(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return anthropicError(
        401,
        "authentication_error",
        "Sign in with your Clauxen account or provide a clx_ API key.",
      );
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

    // Server-only credentials from Vercel / .env (Provider_API_Key + Provider_BASE_URL → /anthropic)
    const providerApiKey = requireProviderApiKey();
    const anthropicBase = requireAnthropicBaseUrl().replace(/\/+$/, "");
    const upstreamUrl = `${anthropicBase}/v1/messages`;

    // Clauxen Code CLI sends product ids (virgil-1.1, legacy clauxen-code, sonnet…).
    // Always resolve to Provider_Model_Clauxen_V1 — never forward raw CLI aliases to Novita.
    const model = env.defaultModel || env.virgilModel;
    const stream = body.stream === true;

    const upstream = await novitaFetch(upstreamUrl, {
      method: "POST",
      headers: {
        // Novita Anthropic-compatible gateway accepts Bearer; also set x-api-key
        // for Anthropic SDK wire compatibility.
        Authorization: `Bearer ${providerApiKey}`,
        "x-api-key": providerApiKey,
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
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return new Response(
        text ||
          JSON.stringify({
            type: "error",
            error: {
              type: "api_error",
              message: "Upstream Novita Messages request failed.",
            },
          }),
        {
          status: upstream.status,
          headers: {
            "Content-Type":
              upstream.headers.get("content-type") || "application/json",
          },
        },
      );
    }

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
          metadata: {
            path: "/api/v1/code/v1/messages",
            upstream: "novita_anthropic",
          },
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

    void debitUserTokens({
      userId: session.id,
      amount: 1,
      modelId: String(model),
      source: "clauxen_code_stream",
      metadata: {
        path: "/api/v1/code/v1/messages",
        stream: true,
        upstream: "novita_anthropic",
      },
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
