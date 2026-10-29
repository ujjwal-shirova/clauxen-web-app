import type { DictationLanguageCode } from "@/shared/lib/dictation-languages";

export type DictationStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "processing";

export type DictationFinishReason = "submitted" | "time-limit" | "track-ended";

export type DictationDevice = {
  deviceId: string;
  label: string;
};

export type DictationResult = {
  text: string;
  finalText: string;
  sessionId: string;
  audioDurationMs: number;
};

export type DictationSelection =
  | { language: "auto" }
  | { language: DictationLanguageCode };

export type ApiEnvelope<T> = { data: T };
