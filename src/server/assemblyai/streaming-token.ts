import "server-only";

import { AppError } from "@/server/db/errors";
import { env, requireAssemblyAiApiKey } from "@/server/config/env";

const TOKEN_REDEMPTION_SECONDS = 60;
export const DICTATION_MAX_SESSION_SECONDS = 15 * 60;

type AssemblyTokenResponse = {
  token?: string;
  expires_in_seconds?: number;
};

export async function createAssemblyStreamingToken(): Promise<{
  token: string;
  expiresInSeconds: number;
  streamingHost: string;
}> {
  // Validate config before fetch so a missing key is not masked as an outage.
  let apiKey: string;
  try {
    apiKey = requireAssemblyAiApiKey();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Assembly_Provider_Key is not configured on the server.";
    throw new AppError(message, 503, "dictation_unavailable");
  }

  const host = env.assemblyAiStreamingHost;
  const url = new URL(`https://${host}/v3/token`);
  url.searchParams.set("expires_in_seconds", String(TOKEN_REDEMPTION_SECONDS));
  url.searchParams.set(
    "max_session_duration_seconds",
    String(DICTATION_MAX_SESSION_SECONDS),
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Authorization: apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("[assemblyai] token request network failure:", error);
    throw new AppError(
      "The dictation service is temporarily unavailable.",
      503,
      "dictation_unavailable",
    );
  }

  if (!response.ok) {
    console.error(
      `[assemblyai] token request failed with status ${response.status}`,
    );
    throw new AppError(
      "The dictation service could not start.",
      502,
      "dictation_token_failed",
    );
  }

  const payload = (await response.json()) as AssemblyTokenResponse;
  if (!payload.token) {
    throw new AppError(
      "The dictation service returned an invalid session.",
      502,
      "dictation_token_invalid",
    );
  }

  return {
    token: payload.token,
    expiresInSeconds: payload.expires_in_seconds ?? TOKEN_REDEMPTION_SECONDS,
    streamingHost: host,
  };
}
