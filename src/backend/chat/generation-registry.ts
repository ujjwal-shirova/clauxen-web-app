/**
 * In-process registry so chat generation can outlive the client SSE connection
 * and only stop when the user explicitly cancels.
 */
type GenerationEntry = {
  controller: AbortController;
  startedAt: number;
};

const generations = new Map<string, GenerationEntry>();

export function beginChatGeneration(chatId: string): AbortController {
  const existing = generations.get(chatId);
  if (existing) {
    existing.controller.abort();
    generations.delete(chatId);
  }
  const controller = new AbortController();
  generations.set(chatId, { controller, startedAt: Date.now() });
  return controller;
}

export function abortChatGeneration(chatId: string): boolean {
  const entry = generations.get(chatId);
  if (!entry) return false;
  entry.controller.abort();
  generations.delete(chatId);
  return true;
}

export function endChatGeneration(chatId: string, controller: AbortController) {
  const entry = generations.get(chatId);
  if (entry?.controller === controller) {
    generations.delete(chatId);
  }
}

export function isChatGenerationActive(chatId: string): boolean {
  return generations.has(chatId);
}
