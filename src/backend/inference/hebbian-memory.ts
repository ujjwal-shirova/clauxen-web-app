/**
 * Hebbian Context Forge — neural-inspired memory prioritization.
 *
 * "Neurons that fire together wire together." This module ranks context
 * chunks by an activation score composed of:
 *   - Recency: how recently was this memory accessed?
 *   - Frequency: how often has it been accessed?
 *   - Relevance: semantic similarity to the current goal.
 *
 * Before each LLM call, we forge the context payload from the highest-scoring
 * memories, keeping the prompt small and focused. This prevents context bloat
 * and "lost in the middle" syndrome without losing critical information.
 *
 * No external embeddings API needed — we use a lightweight bag-of-words
 * cosine similarity that's fast enough for real-time forging.
 */

export type MemoryChunk = {
  id: string;
  text: string;
  role: "system" | "user" | "assistant" | "tool";
  lastAccessed: number;
  accessCount: number;
  /** Pre-computed token estimate (chars / 4). */
  tokenEstimate: number;
};

export type ForgedContext = {
  messages: Array<{ role: string; content: string }>;
  totalTokens: number;
  dropped: number;
};

const RELEVANCE_WINDOW_SIZE = 12;

export class HebbianMemoryForge {
  private memory: Map<string, MemoryChunk> = new Map();
  private maxTokens: number;

  constructor(maxTokens = 100_000) {
    this.maxTokens = maxTokens;
  }

  /** Add or update a memory chunk. */
  remember(
    id: string,
    text: string,
    role: MemoryChunk["role"] = "assistant",
  ): void {
    const existing = this.memory.get(id);
    const now = Date.now();

    if (existing) {
      existing.text = text;
      existing.lastAccessed = now;
      existing.accessCount += 1;
      existing.tokenEstimate = Math.ceil(text.length / 4);
    } else {
      this.memory.set(id, {
        id,
        text,
        role,
        lastAccessed: now,
        accessCount: 1,
        tokenEstimate: Math.ceil(text.length / 4),
      });
    }
  }

  /** Remove a memory chunk. */
  forget(id: string): void {
    this.memory.delete(id);
  }

  /** Clear all memory. */
  clear(): void {
    this.memory.clear();
  }

  /**
   * Forge the context payload for an LLM call.
   * Scores all memory chunks, packs the highest-scoring ones into the payload.
   */
  forgeContext(currentGoal: string, maxTokens?: number): ForgedContext {
    const limit = maxTokens ?? this.maxTokens;
    const now = Date.now();
    const goalVector = this.toVector(currentGoal);

    const scored = Array.from(this.memory.values()).map((chunk) => {
      const recency = 1 / (1 + (now - chunk.lastAccessed) / 60_000);
      const frequency = Math.log(chunk.accessCount + 1);
      const relevance = this.cosineSim(goalVector, this.toVector(chunk.text));
      const activation = recency * 0.3 + frequency * 0.3 + relevance * 0.4;
      return { chunk, activation };
    });

    scored.sort((a, b) => b.activation - a.activation);

    const messages: Array<{ role: string; content: string }> = [];
    let totalTokens = 0;
    let dropped = 0;

    for (const { chunk } of scored) {
      if (totalTokens + chunk.tokenEstimate > limit) {
        dropped += 1;
        continue;
      }
      messages.push({ role: chunk.role, content: chunk.text });
      totalTokens += chunk.tokenEstimate;
      chunk.lastAccessed = now;
      chunk.accessCount += 1;
    }

    return { messages, totalTokens, dropped };
  }

  /** Get recent N chunks (for simple message assembly without scoring). */
  getRecent(n: number): MemoryChunk[] {
    return Array.from(this.memory.values())
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, n);
  }

  /** Number of stored memory chunks. */
  get size(): number {
    return this.memory.size;
  }

  // ── Vector utilities ──────────────────────────────────────────────────

  private toVector(text: string): Map<string, number> {
    const vec = new Map<string, number>();
    const words = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1);

    for (const word of words) {
      vec.set(word, (vec.get(word) ?? 0) + 1);
    }

    // Normalize
    const len = Math.sqrt(Array.from(vec.values()).reduce((s, v) => s + v * v, 0));
    if (len > 0) {
      for (const [k, v] of vec) {
        vec.set(k, v / len);
      }
    }

    return vec;
  }

  private cosineSim(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    for (const [k, v] of a) {
      const bv = b.get(k);
      if (bv !== undefined) dot += v * bv;
    }
    return dot;
  }
}

/**
 * Build the message payload for a chat completion from conversation history.
 * Uses Hebbian scoring to keep the most relevant context within token limits.
 *
 * For simplicity in the chat flow, we use the conversation messages directly
 * but apply the same scoring logic to decide which older turns to include
 * when the conversation is very long.
 */
export function buildConversationPayload(
  messages: Array<{ role: string; content: string }>,
  currentGoal: string,
  maxTokens = 100_000,
): Array<{ role: string; content: string }> {
  const forge = new HebbianMemoryForge(maxTokens);

  // Always keep the system prompt and the last few messages
  const system = messages.find((m) => m.role === "system");
  const recent = messages.slice(-RELEVANCE_WINDOW_SIZE);
  const older = messages.slice(0, -RELEVANCE_WINDOW_SIZE);

  // Add older messages to the forge for relevance scoring
  older.forEach((msg, i) => {
    forge.remember(`msg-${i}`, msg.content, msg.role as MemoryChunk["role"]);
  });

  // If there's nothing older, just return recent
  if (older.length === 0) {
    return messages;
  }

  // Forge relevant older messages
  const forged = forge.forgeContext(currentGoal, maxTokens - recent.reduce((s, m) => s + Math.ceil(m.content.length / 4), 0));

  // Reassemble: system → forged older → recent
  const result: Array<{ role: string; content: string }> = [];
  if (system) result.push(system);
  result.push(...forged.messages.filter((m) => m.role !== "system"));
  result.push(...recent);

  return result;
}
