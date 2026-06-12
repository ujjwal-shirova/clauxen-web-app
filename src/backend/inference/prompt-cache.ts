export type PromptTokenDetails = {
  audio_tokens?: number;
  cached_tokens?: number;
  cache_creation_prompt_tokens?: number;
  cache_read_prompt_tokens?: number;
};

export type NovitaUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  prompt_tokens_details?: PromptTokenDetails;
};

export function extractPromptCacheStats(usage: unknown) {
  const row = usage as NovitaUsage | null | undefined;
  const details = row?.prompt_tokens_details;
  const inputTokens = row?.input_tokens ?? row?.prompt_tokens ?? 0;
  const outputTokens = row?.output_tokens ?? row?.completion_tokens ?? 0;
  const cacheRead =
    row?.cache_read_input_tokens ?? details?.cache_read_prompt_tokens ?? 0;
  const cacheCreation =
    row?.cache_creation_input_tokens ??
    details?.cache_creation_prompt_tokens ??
    0;
  const cachedTokens = details?.cached_tokens ?? cacheRead;

  return {
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens: row?.total_tokens ?? inputTokens + outputTokens,
    cachedTokens,
    cacheCreationTokens: cacheCreation,
    cacheReadTokens: cacheRead,
    cacheHit: cachedTokens > 0 || cacheRead > 0,
  };
}

/** Stable system prompt prefix for prompt-cache friendly requests. */
export function buildCacheableSystemPrefix(content: string) {
  return content.trim();
}

/** Put static context first, dynamic user turns last (prefix caching). */
export function orderMessagesForPromptCache<T extends { role: string }>(
  systemMessages: T[],
  conversationMessages: T[],
) {
  return [...systemMessages, ...conversationMessages];
}
