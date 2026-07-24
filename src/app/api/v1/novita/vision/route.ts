import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import {
  DEFAULT_MODEL,
  getOpenAIClient,
} from "@/server/inference/openai-client";
import { buildVisionContentParts } from "@/server/inference/vision";
import { extractPromptCacheStats } from "@/server/inference/prompt-cache";

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

    const client = getOpenAIClient();
    const content = buildVisionContentParts(body.images ?? [], body.prompt);

    const response = await client.chat.completions.create({
      model: body.model ?? "qwen/qwen2.5-vl-72b-instruct",
      messages: [{ role: "user", content }],
      max_tokens: 4096,
    });

    const text = response.choices[0]?.message?.content ?? "";

    return jsonData({
      content: text,
      usage: extractPromptCacheStats(response.usage),
      model: body.model ?? DEFAULT_MODEL,
    });
  },
  { requireAuth: true },
);
