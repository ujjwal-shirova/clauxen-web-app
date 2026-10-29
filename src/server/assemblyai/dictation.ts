import "server-only";

import { AppError } from "@/server/db/errors";
import { requireAssemblyAiApiKey } from "@/server/config/env";
import type { DictationLanguageCode } from "@/shared/lib/dictation-languages";

const DICTATION_ENDPOINT =
  "https://dictation.assemblyai.com/v1/transcribe/live";

type AssemblyDictationResponse = {
  text?: string;
  llm_response?: string | null;
  session_id?: string;
  audio_duration_ms?: number;
  detail?: string;
  error?: string;
};

export async function transcribeDictation({
  audio,
  languageCode,
  fetchImpl = fetch,
}: {
  audio: ArrayBuffer;
  languageCode?: DictationLanguageCode;
  fetchImpl?: typeof fetch;
}) {
  let apiKey: string;
  try {
    apiKey = requireAssemblyAiApiKey();
  } catch (error) {
    throw new AppError(
      error instanceof Error
        ? error.message
        : "Dictation is not configured on the server.",
      503,
      "dictation_unavailable",
    );
  }

  const body = new FormData();
  body.append(
    "config",
    new Blob(
      [
        JSON.stringify({
          sample_rate: 16_000,
          channels: 1,
          rewrite_mode: "smart",
          ...(languageCode ? { language_codes: [languageCode] } : {}),
        }),
      ],
      { type: "application/json" },
    ),
  );
  body.append(
    "audio",
    new Blob([audio], { type: "audio/pcm" }),
    "dictation.pcm",
  );

  let response: Response;
  try {
    response = await fetchImpl(DICTATION_ENDPOINT, {
      method: "POST",
      headers: { Authorization: apiKey },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    console.error("[assemblyai] dictation network failure:", error);
    throw new AppError(
      "The dictation service is temporarily unavailable.",
      503,
      "dictation_unavailable",
    );
  }

  const payload = (await response
    .json()
    .catch(() => ({}))) as AssemblyDictationResponse;
  if (!response.ok) {
    console.error(
      `[assemblyai] dictation failed with status ${response.status}: ${payload.detail || payload.error || "unknown error"}`,
    );
    if (response.status === 413) {
      throw new AppError(
        "Dictation is limited to 2 minutes per recording.",
        413,
        "dictation_audio_too_large",
      );
    }
    if (response.status === 429) {
      throw new AppError(
        "The dictation service is busy. Please try again shortly.",
        429,
        "dictation_rate_limited",
      );
    }
    throw new AppError(
      "The dictation service could not transcribe this recording.",
      response.status >= 500 ? 503 : 502,
      "dictation_transcription_failed",
    );
  }

  const text = typeof payload.text === "string" ? payload.text : "";
  return {
    text,
    finalText: payload.llm_response?.trim() || text.trim(),
    sessionId: payload.session_id || "",
    audioDurationMs: payload.audio_duration_ms || 0,
  };
}
