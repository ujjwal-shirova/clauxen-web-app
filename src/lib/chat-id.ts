/**
 * Chat ID generator — produces the Clauxen chat URL format.
 *
 * Format: c/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *
 * Characters: a-z and 0-9 (lowercase alphanumeric).
 * This is a 5-group UUID-like format that creates unique, copyable chat URLs
 * similar to ChatGPT's sharing links.
 */

/**
 * Generate a random alphanumeric character (a-z, 0-9).
 */
function randomChar(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return chars[Math.floor(Math.random() * chars.length)];
}

/**
 * Generate a group of n random alphanumeric characters.
 */
function randomGroup(length: number): string {
  let group = "";
  for (let i = 0; i < length; i++) {
    group += randomChar();
  }
  return group;
}

/**
 * Generate a chat ID in the format:
 * xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *
 * This is 5 groups of UUID-v4-style segments joined by hyphens.
 *
 * If `existingIds` is provided, regenerates until the produced id does not
 * collide with any existing chat id (guarantees uniqueness).
 */
export function generateChatId(existingIds?: Iterable<string>): string {
  const used = existingIds ? new Set(existingIds) : null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const groups = [
      randomGroup(8),
      randomGroup(4),
      randomGroup(4),
      randomGroup(4),
      randomGroup(12),
      randomGroup(8),
      randomGroup(4),
      randomGroup(4),
      randomGroup(4),
      randomGroup(12),
      randomGroup(8),
      randomGroup(4),
      randomGroup(4),
      randomGroup(4),
      randomGroup(12),
    ];
    const id = groups.join("-");
    if (!used || !used.has(id)) return id;
  }

  // Extremely unlikely fallback — append a timestamp to force uniqueness.
  return `${randomGroup(8)}-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(12)}-${Date.now().toString(36)}`;
}

/**
 * Validate that a string matches the chat ID format.
 * Accepts any string of lowercase alphanumeric segments separated by hyphens.
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
