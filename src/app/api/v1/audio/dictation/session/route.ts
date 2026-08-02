import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { createAssemblyStreamingToken } from "@/server/assemblyai/streaming-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mimeType: z.string().trim().max(120).default("audio/webm"),
});

export const POST = withApiHandler(
  async ({ request, session }) => {
    requireSession(session);
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
      },
      201,
    );
  },
  { requireAuth: true },
);
