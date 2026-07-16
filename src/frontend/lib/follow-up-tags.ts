import {
  extractFollowUpPrompts,
  stripFollowUpPromptTags,
  stripIncompleteFollowUpPromptTags,
} from "@/lib/follow-up-prompt";

/**
 * Safe markdown href for follow-ups.
 *
 * Must NOT use a custom protocol (`clauxen-prompt://`) — Streamdown's
 * rehype-sanitize strips unknown protocols and rehype-harden then renders
 * the literal text `[blocked]` next to the label.
 *
 * Hash URLs have no protocol, so sanitize keeps them intact.
 */
export const CLAUXEN_PROMPT_HREF_PREFIX = "#clauxen-prompt:";

/** Legacy custom-protocol links (pre-fix). */
const LEGACY_PROMPT_HREF_PREFIX = "clauxen-prompt://";

export type PreparedFollowUpMarkdown = {
  /** Markdown with `<prompt>` tags removed (or converted to safe links). */
  markdown: string;
  /** Extracted follow-up prompts for dedicated UI rendering. */
  prompts: string[];
};

/**
 * Prepare assistant markdown for display:
 * - Extract `<prompt>…</prompt>` into a clean list (rendered as buttons)
 * - Strip tags from the markdown body so rehype never sees custom protocols
 * - Hide incomplete open tags while streaming
 */
export function prepareFollowUpPromptsForMarkdown(
  content: string,
  options: { enabled: boolean; isStreaming?: boolean } = { enabled: true },
): string {
  return prepareFollowUpContent(content, options).markdown;
}

export function prepareFollowUpContent(
  content: string,
  options: { enabled: boolean; isStreaming?: boolean } = { enabled: true },
): PreparedFollowUpMarkdown {
  if (!content) return { markdown: "", prompts: [] };

  if (!options.enabled) {
    return {
      markdown: stripFollowUpPromptTags(content),
      prompts: [],
    };
  }

  let text = options.isStreaming
    ? stripIncompleteFollowUpPromptTags(content)
    : content;

  const prompts = extractFollowUpPrompts(text);

  // Always strip tags from the body — dedicated FollowUpPrompt buttons
  // render below the answer. Never rely on markdown links (harden blocks them).
  if (text.includes("<prompt")) {
    text = stripFollowUpPromptTags(text);
  }

  // Also strip any leftover markdown links from older persisted answers.
  text = text.replace(
    /\[([^\]]+)\]\((?:#clauxen-prompt:|clauxen-prompt:\/\/)[^)]+\)/gi,
    (_match, label: string) => String(label ?? "").trim(),
  );

  // Strip literal " [blocked]" leftovers from harden (persisted streams).
  text = text.replace(/\s*\[blocked\]/gi, "");

  return {
    markdown: text.trimEnd(),
    prompts: options.isStreaming
      ? // While streaming, only expose complete prompts.
        prompts
      : prompts,
  };
}

export function parseClauxenPromptHref(
  href: string | undefined | null,
): string | null {
  if (!href) return null;

  if (href.startsWith(CLAUXEN_PROMPT_HREF_PREFIX)) {
    try {
      return decodeURIComponent(href.slice(CLAUXEN_PROMPT_HREF_PREFIX.length));
    } catch {
      return null;
    }
  }

  if (href.startsWith(LEGACY_PROMPT_HREF_PREFIX)) {
    try {
      return decodeURIComponent(href.slice(LEGACY_PROMPT_HREF_PREFIX.length));
    } catch {
      return null;
    }
  }

  return null;
}
