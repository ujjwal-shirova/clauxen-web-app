import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import {
  getAnthropicClient,
  DEFAULT_MODEL,
} from "@/backend/inference/anthropic-client";
import { buildVisionContentParts } from "@/backend/inference/vision";
import { extractPromptCacheStats } from "@/backend/inference/prompt-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withApiHandler(
  async ({ request }) => {
    const body = (await request.json()) as {
      model?: string;
      prompt: string;
      images?: Array<{
        url?: string;
        base64?: string;
        mimeType?: string;
        detail?: "high" | "low" | "auto";
      }>;
      stream?: boolean;
    };

    const client = getAnthropicClient();
    const content = buildVisionContentParts(body.images ?? [], body.prompt);

    const response = await client.messages.create({
      model: body.model ?? "qwen/qwen2.5-vl-72b-instruct",
      messages: [{ role: "user", content }],
      max_tokens: 4096,
    });

    const text =
      response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("") ?? "";

    return jsonData({
      content: text,
      usage: extractPromptCacheStats(response.usage),
      model: body.model ?? DEFAULT_MODEL,
    });
  },
  { requireChatAuth: true },
);
