/**
 * Chat ID generator — produces the Clauxen chat URL format.
 *
 * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * (8-4-4-4-12 lowercase alphanumeric groups, 32 chars + 4 hyphens = 36)
 *
 * Characters: a-z and 0-9 (lowercase alphanumeric).
 * Compact shareable `/c/...` URLs; shorter than the legacy triple-block ids.
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a group of `length` random alphanumeric characters.
 * Uses Web Crypto when available (browser + modern Node).
 */
function randomGroup(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let group = "";
  for (let i = 0; i < length; i++) {
    group += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return group;
}

/**
 * One UUID-style chat id: 8-4-4-4-12 (36 chars including hyphens).
 */
function nextChatId(): string {
  return [
    randomGroup(8),
    randomGroup(4),
    randomGroup(4),
    randomGroup(4),
    randomGroup(12),
  ].join("-");
}

/**
 * Generate a chat ID in the format:
 * xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *
 * If `existingIds` is provided, regenerates until the produced id does not
 * collide with any existing chat id (guarantees uniqueness).
 */
export function generateChatId(existingIds?: Iterable<string>): string {
  const used = existingIds ? new Set(existingIds) : null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = nextChatId();
    if (!used || !used.has(id)) return id;
  }

  // Extremely unlikely fallback — append a timestamp segment to force uniqueness.
  return `${nextChatId()}-${Date.now().toString(36)}`;
}

/**
 * Validate that a string matches a chat ID format.
 * Accepts the current short form, legacy long multi-block ids, and rare
 * collision-fallback suffixes (hyphenated lowercase alphanumeric).
 */
export function isValidChatId(id: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)+$/.test(id) && id.length >= 20;
}

/**
 * Build the chat URL path for a given chat ID.
 */
export function chatUrlPath(chatId: string): string {
  return `/c/${chatId}`;
}
