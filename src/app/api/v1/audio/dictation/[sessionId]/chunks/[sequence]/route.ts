import { withApiHandler } from "@/server/http/api-handler";
import { requireSession } from "@/server/auth/require-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dictation audio is no longer persisted — accept and discard chunk uploads. */
export const PUT = withApiHandler(
  async ({ session }) => {
    requireSession(session);
    return new Response(null, { status: 204 });
  },
  { requireAuth: true },
);
