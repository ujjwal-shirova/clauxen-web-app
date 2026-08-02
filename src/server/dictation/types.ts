export const DICTATION_MANIFEST_VERSION = 1 as const;

export type DictationFinishReason =
  | "submitted"
  | "cancelled"
  | "page-hidden"
  | "track-ended"
  | "error";

export type DictationChunk = {
  sequence: number;
  key: string;
  sizeBytes: number;
  storedAt: string;
};

export type DictationManifest = {
  version: typeof DICTATION_MANIFEST_VERSION;
  sessionId: string;
  userId: string;
  status: "recording" | "finalizing" | "completed";
  mimeType: string;
  extension: string;
  createdAt: string;
  updatedAt: string;
  chunks: DictationChunk[];
  finishReason?: DictationFinishReason;
  transcript?: string;
  audioKey?: string;
  sizeBytes?: number;
};
