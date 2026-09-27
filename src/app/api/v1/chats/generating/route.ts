import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as chatService from "@/server/services/chat.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Chat ids whose assistant turn is still running, including after the browser closes. */
export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const ids = await chatService.listGeneratingChatIds(user.id);
    return jsonData({ ids });
  },
  { requireAuth: true, requireChatAuth: true },
);
