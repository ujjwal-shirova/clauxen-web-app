import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { getNovitaClient, DEFAULT_MODEL } from "@/backend/inference/novita-client";
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

    const client = getNovitaClient();
    const content = buildVisionContentParts(body.images ?? [], body.prompt);

    const response = await client.chat.completions.create({
      model: body.model ?? "qwen/qwen2.5-vl-72b-instruct",
      messages: [{ role: "user", content }],
      stream: false,
      max_tokens: 4096,
    });

    return jsonData({
      content: response.choices[0]?.message?.content ?? "",
      usage: extractPromptCacheStats(response.usage),
      model: body.model ?? DEFAULT_MODEL,
    });
  },
  { requireChatAuth: true },
);
