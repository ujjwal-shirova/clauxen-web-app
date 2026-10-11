/** Novita documents enable_thinking; official OpenAI uses reasoning_effort. */
export function providerThinkingControls(input: {
  baseURL?: string;
  thinkingEnabled?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
}): {
  enable_thinking?: boolean;
  reasoning_effort?: "low" | "medium" | "high";
} {
  let isNovita = false;
  try {
    const host = new URL(input.baseURL ?? "https://api.openai.com").hostname;
    isNovita = host === "novita.ai" || host.endsWith(".novita.ai");
  } catch {
    // The SDK reports malformed endpoints; do not infer provider extensions.
  }
  if (isNovita) {
    return input.thinkingEnabled === undefined
      ? {}
      : { enable_thinking: input.thinkingEnabled };
  }
  return input.reasoningEffort
    ? { reasoning_effort: input.reasoningEffort }
    : {};
}
