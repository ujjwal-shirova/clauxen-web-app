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
];

export function stripAssistantStreamArtifacts(text: string): string {
  if (!text) return "";
  let cleaned = text;
  for (const pattern of STREAM_ARTIFACT_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned;
}

/** Sanitize a streaming delta; returns empty string when nothing visible remains. */
export function sanitizeAssistantStreamDelta(delta: string): string {
  return stripAssistantStreamArtifacts(delta);
}
