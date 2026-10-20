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
  | "time-limit"
  | "silence"
  | "remote-closed"
  | "error";

export type DictationSessionResponse = {
  sessionId: string;
  token: string;
  tokenExpiresInSeconds: number;
  streamingHost: string;
  sampleRate: number;
  speechModel: "universal-3-6-pro";
  mode: "max_accuracy";
  voiceFocus: "near-field";
  voiceFocusThreshold: number;
  /** Hard per-session streaming cap enforced by the server token. */
  maxSessionSeconds?: number;
  /** Auto-stop after this many seconds without detected speech. */
  inactivityTimeoutSeconds?: number;
};

export type ApiEnvelope<T> = { data: T };
