import {
  stripFollowUpPromptTags,
  stripIncompleteFollowUpPromptTags,
} from "@/lib/follow-up-prompt";

export const CLAUXEN_PROMPT_HREF_PREFIX = "clauxen-prompt://";

/**
 * Convert complete `<prompt>…</prompt>` tags into markdown links the renderer
 * turns into clickable follow-up chips. Incomplete open tags are hidden while
 * streaming so raw markup never flashes.
 */
export function prepareFollowUpPromptsForMarkdown(
  content: string,
  options: { enabled: boolean; isStreaming?: boolean } = { enabled: true },
): string {
  if (!content) return "";
  if (!options.enabled) {
    return stripFollowUpPromptTags(content);
  }

  let text = options.isStreaming
    ? stripIncompleteFollowUpPromptTags(content)
    : content;

  if (!text.includes("<prompt")) return text;

  return text.replace(
    /<prompt(?:\s[^>]*)?>([\s\S]*?)<\/prompt>/gi,
    (_match, inner: string) => {
      const prompt = String(inner ?? "").replace(/\s+/g, " ").trim();
      if (!prompt) return "";
      // Escape brackets in link label so markdown stays valid.
      const label = prompt.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
      return `[${label}](${CLAUXEN_PROMPT_HREF_PREFIX}${encodeURIComponent(prompt)})`;
    },
  );
}

export function parseClauxenPromptHref(href: string | undefined | null): string | null {
  if (!href?.startsWith(CLAUXEN_PROMPT_HREF_PREFIX)) return null;
  try {
    return decodeURIComponent(href.slice(CLAUXEN_PROMPT_HREF_PREFIX.length));
  } catch {
    return null;
  }
}
