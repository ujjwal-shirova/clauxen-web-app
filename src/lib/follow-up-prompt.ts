/**
 * Model-emitted clickable follow-up prompts via `<prompt>...</prompt>` tags.
 * Injected into the system prompt only when the user has follow-ups enabled.
 */

export const FOLLOW_UP_PROMPT_TAG = "prompt";

/** System instruction appended when Settings → Follow-up suggestions is ON. */
export function buildFollowUpSystemInstruction(): string {
  return `<follow_up_prompts>
Near the end of your final reply, suggest 2–5 short follow-up actions the user might take next.
Emit each as an HTML-style \`<prompt>\` tag. Tags may appear inside any markdown structure (lists, paragraphs, headings) — the UI renders them as clickable prompts:

- <prompt>Explain this in more detail</prompt>
- <prompt>Show the implementation</prompt>
- <prompt>Compare with other approaches</prompt>

Rules:
- Place them after the main answer (a short list is ideal).
- Keep each prompt under ~12 words, specific to this conversation — not generic filler.
- Do not wrap \`<prompt>\` tags in code fences or backticks.
- Do not invent a separate "Follow-ups:" heading unless it helps readability.
- Only emit \`<prompt>\` tags when this instruction is present. If it is absent, never emit them.
</follow_up_prompts>`;
}

const PROMPT_TAG_RE =
  /<prompt(?:\s[^>]*)?>([\s\S]*?)<\/prompt>/gi;
const INCOMPLETE_PROMPT_OPEN_RE = /<prompt(?:\s[^>]*)?(?:>[\s\S]*)?$/i;

/** Remove complete + incomplete prompt tags (toggle off / model hygiene). */
export function stripFollowUpPromptTags(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(PROMPT_TAG_RE, (_match, inner: string) =>
    String(inner ?? "").trim(),
  );
  cleaned = cleaned.replace(INCOMPLETE_PROMPT_OPEN_RE, "");
  return cleaned;
}

/** Hide incomplete trailing `<prompt` while streaming; leave complete tags intact. */
export function stripIncompleteFollowUpPromptTags(text: string): string {
  if (!text || !text.includes("<prompt")) return text;
  return text.replace(INCOMPLETE_PROMPT_OPEN_RE, "");
}

export function extractFollowUpPrompts(text: string): string[] {
  if (!text) return [];
  const prompts: string[] = [];
  const re = new RegExp(PROMPT_TAG_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const prompt = String(match[1] ?? "").trim();
    if (prompt) prompts.push(prompt);
  }
  return prompts;
}
