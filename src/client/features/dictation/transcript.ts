export type CaretRange = { start: number; end: number };

export function clampCaret(caret: CaretRange, length: number): CaretRange {
  const start = Math.max(0, Math.min(caret.start, length));
  const end = Math.max(start, Math.min(caret.end, length));
  return { start, end };
}

export function splitDraftAroundCaret(draft: string, caret: CaretRange) {
  const range = clampCaret(caret, draft.length);
  return {
    prefix: draft.slice(0, range.start),
    suffix: draft.slice(range.end),
  };
}

export function insertTranscriptAtCaret(
  prefix: string,
  transcript: string,
  suffix: string,
): { text: string; caret: CaretRange } {
  if (!transcript) {
    return {
      text: `${prefix}${suffix}`,
      caret: { start: prefix.length, end: prefix.length },
    };
  }
  const head =
    !prefix || /\s$/.test(prefix) || prefix.endsWith("\n")
      ? prefix
      : `${prefix} `;
  const tail =
    !suffix || /^\s/.test(suffix) || suffix.startsWith("\n")
      ? suffix
      : ` ${suffix}`;
  const insertEnd = head.length + transcript.length;
  return {
    text: `${head}${transcript}${tail}`,
    caret: { start: insertEnd, end: insertEnd },
  };
}
