import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { applySharePrivacyHeaders } from "@/server/http/share-privacy";
import { requireSession } from "@/server/auth/require-session";
import {
  publishShareLink,
  readShareState,
  revokeShareLink,
} from "@/server/services/chat-share.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ chatId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const state = await readShareState(user.id, params.chatId);
    return applySharePrivacyHeaders(jsonData(state));
  },
  { requireAuth: true },
);

export const POST = withApiRouteParams<{ chatId: string }>(
  async ({ session, request, params }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => ({}))) as {
      revoke?: boolean;
    };

    if (body.revoke) {
      const state = await revokeShareLink(user.id, params.chatId);
      return applySharePrivacyHeaders(jsonData(state));
    }

    const state = await publishShareLink(user.id, params.chatId);
    const created = state.share != null;
    return applySharePrivacyHeaders(jsonData(state, created ? 201 : 200));
  },
  { requireAuth: true },
);
