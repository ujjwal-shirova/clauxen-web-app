import { z } from "zod";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { assertDurableRateLimit } from "@/server/http/durable-rate-limit";
import { AppError } from "@/server/db/errors";
import { transcribeDictation } from "@/server/assemblyai/dictation";
import { DICTATION_LANGUAGE_CODES } from "@/shared/lib/dictation-languages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PCM_BYTES = 120 * 16_000 * 2;
const languageSchema = z.enum(DICTATION_LANGUAGE_CODES).optional();

export const POST = withApiHandler(
  async ({ request, session }) => {
    const user = requireSession(session);
    await Promise.all([
      assertDurableRateLimit({
        key: `dictation:user:${user.id}:min`,
        limit: 8,
        windowMs: 60_000,
        message: "Too many dictation requests. Please wait a moment.",
      }),
      assertDurableRateLimit({
        key: `dictation:user:${user.id}:hour`,
        limit: 60,
        windowMs: 60 * 60_000,
        message: "Hourly dictation limit reached. Please try again later.",
      }),
    ]);

    const form = await request.formData().catch(() => {
      throw new AppError(
        "Dictation audio is required.",
        400,
        "dictation_invalid",
      );
    });
    const audio = form.get("audio");
    if (!audio || typeof audio === "string") {
      throw new AppError(
        "Dictation audio is required.",
        400,
        "dictation_invalid",
      );
    }
    if (
      audio.type !== "audio/pcm" &&
      audio.type !== "application/octet-stream"
    ) {
      throw new AppError(
        "Dictation audio must be 16-bit PCM.",
        415,
        "dictation_unsupported_audio",
      );
    }
    if (audio.size < 320 || audio.size > MAX_PCM_BYTES) {
      throw new AppError(
        "Dictation is limited to 2 minutes per recording.",
        413,
        "dictation_audio_too_large",
      );
    }
    const parsedLanguage = languageSchema.safeParse(
      form.get("languageCode") || undefined,
    );
    if (!parsedLanguage.success) {
      throw new AppError(
        "The selected dictation language is not supported.",
        400,
        "dictation_invalid_language",
      );
    }
    const languageCode = parsedLanguage.data;
    const result = await transcribeDictation({
      audio: await audio.arrayBuffer(),
      languageCode,
    });
    return jsonData(result);
  },
  { requireAuth: true },
);
