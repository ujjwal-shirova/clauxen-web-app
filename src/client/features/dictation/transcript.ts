import type { AssemblyTurnEvent } from "@/features/dictation/types";

export type StreamingTranscriptState = {
  finalized: Record<number, string>;
  partial: { order: number; text: string } | null;
};

export type CaretRange = { start: number; end: number };

export const EMPTY_STREAMING_TRANSCRIPT: StreamingTranscriptState = {
  finalized: {},
  partial: null,
};

export function applyAssemblyTurn(
  state: StreamingTranscriptState,
  turn: AssemblyTurnEvent,
): StreamingTranscriptState {
  const text = turn.transcript.trim();
  if (turn.end_of_turn) {
    return {
      finalized: { ...state.finalized, [turn.turn_order]: text },
      partial: state.partial?.order === turn.turn_order ? null : state.partial,
    };
  }
  if (turn.turn_order in state.finalized) return state;
  return {
    finalized: state.finalized,
    partial: { order: turn.turn_order, text },
  };
}

export function transcriptText(state: StreamingTranscriptState): string {
  const turns = Object.entries(state.finalized)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, text]) => text.trim())
    .filter(Boolean);
  if (state.partial?.text.trim()) turns.push(state.partial.text.trim());
  return turns.join(" ").trim();
}

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

/**
 * Insert live transcript at the captured caret without erasing surrounding
 * draft text. Keeps a single space at the splice when the user left none.
 */
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

/** @deprecated Prefer insertTranscriptAtCaret — appends at the end of draft. */
export function joinDraftAndTranscript(draft: string, transcript: string) {
  return insertTranscriptAtCaret(draft, transcript, "").text;
}
