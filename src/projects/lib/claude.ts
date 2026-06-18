import OpenAI from "openai";
import { env, requireNovitaApiKey } from "@/backend/config/env";

const DEFAULT_MODEL = "nex-agi/nex-n2-pro";

let openAiClient: OpenAI | null = null;

function getOpenAi() {
  const apiKey = requireNovitaApiKey();
  openAiClient ??= new OpenAI({
    apiKey,
    baseURL: env.novitaOpenAiBaseUrl.replace(/\/+$/, ""),
  });
  return openAiClient;
}

export type StreamMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function streamClaudeResponse(options: {
  system?: string;
  messages: StreamMessage[];
  model?: string;
  thinkingLevel?: string;
  onToken: (token: string) => void;
}) {
  const client = getOpenAi();
  const model = options.model ?? DEFAULT_MODEL;

  const stream = await client.chat.completions.create({
    model,
    max_tokens: 8192,
    stream: true,
    messages: [
      ...(options.system
        ? [{ role: "system" as const, content: options.system }]
        : []),
      ...options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
  });

  let fullText = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (!delta) continue;
    fullText += delta;
    options.onToken(delta);
  }

  return fullText;
}
