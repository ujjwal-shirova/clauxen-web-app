import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { assertDurableRateLimit } from "@/server/http/durable-rate-limit";
import {
  createAssemblyStreamingToken,
  DICTATION_INACTIVITY_TIMEOUT_SECONDS,
  DICTATION_MAX_SESSION_SECONDS,
} from "@/server/assemblyai/streaming-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mimeType: z.string().trim().max(120).default("audio/webm"),
});

export const POST = withApiHandler(
  async ({ request, session }) => {
    const user = requireSession(session);
    // Each session can stream at most DICTATION_MAX_SESSION_SECONDS, so these
    // windows bound the worst-case AssemblyAI spend per user.
    await Promise.all([
      assertDurableRateLimit({
        key: `dictation-session:user:${user.id}:min`,
        limit: 6,
        windowMs: 60_000,
        message: "Too many dictation sessions. Please wait a moment.",
      }),
      assertDurableRateLimit({
        key: `dictation-session:user:${user.id}:hour`,
        limit: 40,
        windowMs: 60 * 60_000,
        message: "Hourly dictation limit reached. Please try again later.",
      }),
    ]);
    // mimeType accepted for backward compat — audio is never persisted to R2.
    requestSchema.safeParse(await request.json().catch(() => ({})));

    const assembly = await createAssemblyStreamingToken();

    return jsonData(
      {
        // Ephemeral client correlation id only — not an R2 recording session.
        sessionId: randomUUID(),
        token: assembly.token,
        tokenExpiresInSeconds: assembly.expiresInSeconds,
        streamingHost: assembly.streamingHost,
        sampleRate: 16_000,
        speechModel: "universal-3-5-pro" as const,
        mode: "balanced" as const,
        maxSessionSeconds: DICTATION_MAX_SESSION_SECONDS,
        inactivityTimeoutSeconds: DICTATION_INACTIVITY_TIMEOUT_SECONDS,
      },
      201,
    );
  },
  { requireAuth: true },
);
