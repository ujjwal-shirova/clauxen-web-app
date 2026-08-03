/** Strip prompt/UI artifacts that must never appear in visible assistant output. */
const STREAM_ARTIFACT_PATTERNS: RegExp[] = [
  /<userMemories>[\s\S]*?<\/userMemories>/gi,
  /<memory_system>[\s\S]*?<\/memory_system>/gi,
  /<memory_overview>[\s\S]*?<\/memory_overview>/gi,
  /<memory_application_instructions>[\s\S]*?<\/memory_application_instructions>/gi,
  /<forbidden_memory_phrases>[\s\S]*?<\/forbidden_memory_phrases>/gi,
  /<example_user_memories>[\s\S]*?<\/example_user_memories>/gi,
  /<chat_title>[\s\S]*?<\/chat_title>/gi,
  /<\/?userMemories>/gi,
  /<\/?memory_system>/gi,
  /<\/?memory_overview>/gi,
  /<\/?chat_title>/gi,
  /<create_file[\s\S]*?<\/create_file>/gi,
  /<\/?create_file[^>]*>/gi,
];

/**
 * Defensive net for hallucinated citation/tool-call tags (e.g. `<sntml:cite index="...">claim</sntml:cite>`,
 * `<cite ...>`, `<document_context>`). The model is instructed never to emit these, but if it slips,
 * unwrap the tag and keep the inner text so the sentence still reads correctly instead of leaking raw markup.
 */
const CITE_LIKE_TAG_PATTERN =
  /<\/?(?:sntml|antml):(?:cite|function_calls|invoke|parameter)[^>]*>/gi;
const DOCUMENT_CONTEXT_PATTERN =
  /<\/?document_context[^>]*>/gi;

export function stripAssistantStreamArtifacts(text: string): string {
  if (!text) return "";
  let cleaned = text;
  for (const pattern of STREAM_ARTIFACT_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(CITE_LIKE_TAG_PATTERN, "");
  cleaned = cleaned.replace(DOCUMENT_CONTEXT_PATTERN, "");
  return cleaned;
}

/** Sanitize a streaming delta; returns empty string when nothing visible remains. */
export function sanitizeAssistantStreamDelta(delta: string): string {
  return stripAssistantStreamArtifacts(delta);
}
