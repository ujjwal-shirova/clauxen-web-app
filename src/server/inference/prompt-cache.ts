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

/** Stable system prompt prefix for prompt-cache friendly requests.
 * Novita auto-caches prompt prefixes (typically after they exceed ~1024 tokens).
 * Keep the returned value byte-identical across requests for the same "static head".
 */
export function buildCacheableSystemPrefix(content: string) {
  return content.trim();
}

/** Put static context first, dynamic user turns last (prefix caching).
 * For full model .md system prompts (large, >1024 tokens) this ensures the
 * expensive prefix is computed once and served from cache on repeat turns.
 */
export function orderMessagesForPromptCache<T extends { role: string }>(
  systemMessages: T[],
  conversationMessages: Array<{ role: string } & Record<string, unknown>>,
) {
  // Concat preserving caller's element type for system prefix, then the rest.
  return [...systemMessages, ...conversationMessages] as T[];
}

/** Returns true if content length suggests it will benefit from Novita prefix cache. */
export function willLikelyUsePromptCache(text: string): boolean {
  // Rough token estimate; actual server threshold ~1024 tokens.
  return text.trim().length > 3000; // our MD prompts are >> this
}
