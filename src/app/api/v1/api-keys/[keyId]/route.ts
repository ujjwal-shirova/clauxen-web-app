import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as apiKeysRepo from "@/backend/repositories/api-keys.repository";

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
