import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import { getResearch } from "@/server/repositories/deep-research.repository";
import { loadResearchReport } from "@/server/chat/research-report";
import { notFound } from "@/server/db/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withApiRouteParams<{ chatId: string; toolId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const plan = await getResearch(params.chatId, params.toolId, user.id);
    if (!plan) throw notFound("Research not found.");
    const report = await loadResearchReport(plan);
    if (!report)
      throw notFound(
        "The report is still being saved. Please try again shortly.",
      );
    return Response.json(
      { data: { report } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  },
  { requireAuth: true, requireChatAuth: true },
);
