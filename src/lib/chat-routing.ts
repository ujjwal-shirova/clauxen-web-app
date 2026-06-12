export type ChatRoutingThinkingType = "enabled" | "disabled";

/** Agent timeline path when web search and/or thinking tools are enabled. */
export function shouldUseAgentPath(input: {
  webSearchEnabled?: boolean;
  thinkingType?: ChatRoutingThinkingType;
}): boolean {
  return (
    input.thinkingType === "enabled" || input.webSearchEnabled === true
  );
}

/** Split status prose from the final article in the last assistant turn. */
export function splitFinalAnswerContent(content: string): {
  preamble: string;
  answer: string;
} {
  const trimmed = content.trim();
  if (!trimmed) return { preamble: "", answer: "" };

  const markdownHeading = trimmed.match(/\n(?=#{1,3}\s)/);
  if (markdownHeading?.index != null && markdownHeading.index > 0) {
    return {
      preamble: trimmed.slice(0, markdownHeading.index).trim(),
      answer: trimmed.slice(markdownHeading.index).trim(),
    };
  }

  if (trimmed.startsWith("#")) {
    return { preamble: "", answer: trimmed };
  }

  const articleLead = trimmed.match(
    /\n\n+(?=(?:\*\*)?[A-Z][^\n]{10,}(?:\*\*)?(?:\s*\(|:|\n))/,
  );
  if (articleLead?.index != null && articleLead.index > 0) {
    return {
      preamble: trimmed.slice(0, articleLead.index).trim(),
      answer: trimmed.slice(articleLead.index).trim(),
    };
  }

  if (
    /^(?:let me|now let me|i now have|i'll|i will)\b/i.test(trimmed) &&
    !/^#{1,3}\s/m.test(trimmed)
  ) {
    return { preamble: trimmed, answer: "" };
  }

  return { preamble: "", answer: trimmed };
}

export function streamTextInChunks(
  text: string,
  emit: (chunk: string) => void,
  chunkSize = 48,
) {
  if (!text) return;
  for (let index = 0; index < text.length; index += chunkSize) {
    emit(text.slice(index, index + chunkSize));
  }
}
