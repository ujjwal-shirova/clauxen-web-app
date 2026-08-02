import type { AssemblyTurnEvent } from "@/features/dictation/types";

export type StreamingTranscriptState = {
  finalized: Record<number, string>;
  partial: { order: number; text: string } | null;
};

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

export function joinDraftAndTranscript(draft: string, transcript: string) {
  if (!transcript) return draft;
  if (!draft) return transcript;
  return /\s$/.test(draft) ? `${draft}${transcript}` : `${draft} ${transcript}`;
}
