const CURSOR_WORD = /\bCursor(?:'s)?\b/gi;

/** Drop the word Cursor from plugin copy shown on the plugins page. */
export function stripCursorText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(CURSOR_WORD, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([·|/])\s+/g, " $1 ")
    .replace(/(?:^|\s)[·|/](?=\s|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Keep card blurbs short and end them with a period or an ellipsis. */
export function cardDescription(
  value: string | null | undefined,
  limit = 48,
): string {
  const cleaned = stripCursorText(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= limit) {
    return /[.!?…]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  }
  let cut = cleaned.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 20) cut = cut.slice(0, lastSpace);
  cut = cut.replace(/[.,;:!?…\-–—]+$/g, "").trim();
  return `${cut}...`;
}
