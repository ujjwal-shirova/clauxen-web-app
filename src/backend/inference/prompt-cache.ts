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
  prompt_tokens_details?: PromptTokenDetails;
};

export function extractPromptCacheStats(usage: unknown) {
  const row = usage as NovitaUsage | null | undefined;
  const details = row?.prompt_tokens_details;
  return {
    promptTokens: row?.prompt_tokens ?? 0,
    completionTokens: row?.completion_tokens ?? 0,
    totalTokens: row?.total_tokens ?? 0,
    cachedTokens: details?.cached_tokens ?? 0,
    cacheCreationTokens: details?.cache_creation_prompt_tokens ?? 0,
    cacheReadTokens: details?.cache_read_prompt_tokens ?? 0,
    cacheHit: (details?.cached_tokens ?? 0) > 0,
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
