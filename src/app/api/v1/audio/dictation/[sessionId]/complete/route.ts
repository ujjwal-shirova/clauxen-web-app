import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dictation audio is no longer persisted — complete is a no-op success. */
export const POST = withApiHandler(
  async ({ session }) => {
    requireSession(session);
    return jsonData({ ok: true, persisted: false });
  },
  { requireAuth: true },
);
