import { AppError } from "@/server/db/errors";

type ChatBindings = {
  Provider_API_Key?: string;
  GENERATIONS_INTERNAL_TOKEN?: string;
  CHAT_COORD_INTERNAL_TOKEN?: string;
  SCHEDULED_TASKS_INTERNAL_TOKEN?: string;
  GENERATIONS_EXECUTION_ORIGIN?: string;
  GENERATION_QUEUE?: unknown;
};

/** Validate deployed bindings, never credentials baked into the build. */
export function assertCloudflareChatConfiguration(
  bindings: ChatBindings,
  durable = true,
) {
  const missing: string[] = [];
  if (!bindings.Provider_API_Key?.trim()) missing.push("Provider_API_Key");
  if (durable) {
    if (
      !bindings.GENERATIONS_INTERNAL_TOKEN?.trim() &&
      !bindings.CHAT_COORD_INTERNAL_TOKEN?.trim() &&
      !bindings.SCHEDULED_TASKS_INTERNAL_TOKEN?.trim()
    )
      missing.push("generation authentication");
    if (!bindings.GENERATION_QUEUE) missing.push("GENERATION_QUEUE");
    if (!bindings.GENERATIONS_EXECUTION_ORIGIN?.trim())
      missing.push("GENERATIONS_EXECUTION_ORIGIN");
  }
  if (missing.length) {
    console.error("[chat] missing deployed bindings", { missing });
    throw new AppError(
      "Chat is temporarily unavailable. Please try again shortly.",
      503,
      "chat_runtime_unconfigured",
    );
  }
}
