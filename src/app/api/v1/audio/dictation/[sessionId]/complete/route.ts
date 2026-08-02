import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { completeDictationRecording } from "@/server/dictation/recording-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  reason: z.enum([
    "submitted",
    "cancelled",
    "page-hidden",
    "track-ended",
    "error",
  ]),
  transcript: z.string().max(100_000).optional(),
  background: z.boolean().optional().default(false),
});

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params;

  return withApiHandler(
    async ({ session }) => {
      const user = requireSession(session);
      const body = requestSchema.parse(await request.json());
      const work = () =>
        completeDictationRecording({
          userId: user.id,
          sessionId,
          reason: body.reason,
          transcript: body.transcript,
        });

      if (body.background) {
        after(async () => {
          // Let a keepalive chunk already accepted by Vercel finish its R2 write.
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          await work().catch((error) => {
            console.error("[dictation] background finalization failed", error);
          });
        });
        return jsonData({ accepted: true }, 202);
      }

      const manifest = await work();
      return jsonData({
        sessionId: manifest.sessionId,
        status: manifest.status,
        sizeBytes: manifest.sizeBytes ?? 0,
      });
    },
    { requireAuth: true },
  )(request);
}
