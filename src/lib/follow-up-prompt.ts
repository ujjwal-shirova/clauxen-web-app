/**
 * Model-emitted clickable follow-up prompts via `<prompt>...</prompt>` tags.
 * Injected into the system prompt only when the user has follow-ups enabled.
 */

export const FOLLOW_UP_PROMPT_TAG = "prompt";

/** System instruction appended when Settings → Follow-up suggestions is ON. */
export function buildFollowUpSystemInstruction(): string {
  return `<follow_up_prompts>
Near the end of your final reply, suggest 2–5 short follow-up actions the user might take next.
Emit each as an HTML-style \`<prompt>\` tag on its own line. The UI renders them as clickable prompts:

- <prompt>Explain this in more detail</prompt>
- <prompt>Show the implementation</prompt>
- <prompt>Compare with other approaches</prompt>

Rules:
- Place them after the main answer (a short list is ideal).
- Keep each prompt under ~12 words, specific to this conversation — not generic filler.
- Do not wrap \`<prompt>\` tags in code fences or backticks.
- Do not invent a separate "Follow-ups:" heading unless it helps readability.
- Do not emit markdown links for follow-ups — only \`<prompt>\` tags.
- Only emit \`<prompt>\` tags when this instruction is present. If it is absent, never emit them.
- When the user sends a follow-up (including one of these prompts), answer THAT question directly using prior conversation context — do not restart a generic overview.
</follow_up_prompts>`;
}

const PROMPT_TAG_RE =
  /<prompt(?:\s[^>]*)?>([\s\S]*?)<\/prompt>/gi;
const INCOMPLETE_PROMPT_OPEN_RE = /<prompt(?:\s[^>]*)?(?:>[\s\S]*)?$/i;

/** Remove complete + incomplete prompt tags (toggle off / model hygiene). */
export function stripFollowUpPromptTags(text: string): string {
  if (!text) return "";
  // Remove the whole tag — do not leave the inner text in the markdown body
  // (dedicated FollowUpPrompt buttons render the prompts separately).
  let cleaned = text.replace(PROMPT_TAG_RE, "");
  cleaned = cleaned.replace(INCOMPLETE_PROMPT_OPEN_RE, "");
  return cleaned.replace(/\n{3,}/g, "\n\n").trimEnd();
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
