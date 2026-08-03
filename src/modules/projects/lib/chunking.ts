const APPROX_CHARS_PER_TOKEN = 4;
const CHUNK_TOKENS = 512;
const OVERLAP_TOKENS = 64;

function approxTokenLength(text: string) {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

function splitParagraphs(text: string) {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitSentences(paragraph: string) {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = splitParagraphs(normalized);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  const appendWithOverlap = (segment: string) => {
    const candidate = current ? `${current}\n\n${segment}` : segment;
    if (approxTokenLength(candidate) <= CHUNK_TOKENS) {
      current = candidate;
      return;
    }

    if (current) {
      flush();
      if (approxTokenLength(segment) <= CHUNK_TOKENS) {
        current = segment;
        return;
      }
    }

    const sentences = splitSentences(segment);
    let sentenceBuf = "";
    for (const sentence of sentences) {
      const next = sentenceBuf ? `${sentenceBuf} ${sentence}` : sentence;
      if (approxTokenLength(next) <= CHUNK_TOKENS) {
        sentenceBuf = next;
      } else {
        if (sentenceBuf) chunks.push(sentenceBuf);
        sentenceBuf = sentence;
      }
    }
    if (sentenceBuf) {
      current = sentenceBuf;
    }
  };

  for (const paragraph of paragraphs) {
    appendWithOverlap(paragraph);
    if (approxTokenLength(current) >= CHUNK_TOKENS * 0.9) {
      flush();
    }
  }
  flush();

  if (chunks.length <= 1) return chunks;

  const overlapped: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (i === 0) {
      overlapped.push(chunk);
      continue;
    }
    const prev = chunks[i - 1];
    const overlapChars = OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;
    const tail = prev.slice(Math.max(0, prev.length - overlapChars));
    overlapped.push(`${tail}\n\n${chunk}`.trim());
  }
  return overlapped;
}
