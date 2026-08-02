import type { NextRequest } from "next/server";
import { AppError } from "@/server/db/errors";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import {
  MAX_DICTATION_CHUNK_BYTES,
  storeDictationChunk,
} from "@/server/dictation/recording-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ sessionId: string; sequence: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const { sessionId, sequence: rawSequence } = await context.params;
  const sequence = Number(rawSequence);

  return withApiHandler(
    async ({ session }) => {
      const user = requireSession(session);
      const declaredLength = Number(request.headers.get("content-length") ?? 0);
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_DICTATION_CHUNK_BYTES
      ) {
        throw new AppError(
          "Dictation chunk is too large.",
          413,
          "dictation_chunk_too_large",
        );
      }

      const body = new Uint8Array(await request.arrayBuffer());
      const chunk = await storeDictationChunk({
        userId: user.id,
        sessionId,
        sequence,
        body,
        contentType:
          request.headers.get("content-type") ?? "application/octet-stream",
      });
      return jsonData({
        sequence: chunk.sequence,
        sizeBytes: chunk.sizeBytes,
      });
    },
    { requireAuth: true },
  )(request);
}
