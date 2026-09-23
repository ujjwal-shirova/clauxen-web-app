export const DOCUMENT_TITLE_BRAND = "Clauxen";

/** Browser tab title for an open chat. Untitled chats stay brand-only. */
export function formatChatTabTitle(title: string | null | undefined): string {
  const name = title?.trim() ?? "";
  if (!name || /^new chat$/i.test(name)) return DOCUMENT_TITLE_BRAND;
  return `${name} - ${DOCUMENT_TITLE_BRAND}`;
}
