export type AssemblyTurnEvent = {
  type: "Turn";
  turn_order: number;
  end_of_turn: boolean;
  transcript: string;
};

export type DictationStatus = "idle" | "connecting" | "listening" | "stopping";

export type DictationFinishReason =
  | "submitted"
  | "cancelled"
  | "page-hidden"
  | "track-ended"
  | "error";

export type DictationSessionResponse = {
  sessionId: string;
  token: string;
  tokenExpiresInSeconds: number;
  streamingHost: string;
  sampleRate: number;
  speechModel: "universal-3-5-pro";
  mode: "balanced";
};

export type ApiEnvelope<T> = { data: T };
