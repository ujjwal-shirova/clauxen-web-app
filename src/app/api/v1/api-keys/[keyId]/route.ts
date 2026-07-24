import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as apiKeysRepo from "@/server/repositories/api-keys.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withApiRouteParams<{ keyId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    await apiKeysRepo.revokeApiKey(user.id, params.keyId);
    return jsonData({ ok: true });
  },
  { requireAuth: true },
);
