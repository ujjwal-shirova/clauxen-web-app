import { withApiRouteParams } from "@/server/http/route-params";
import { requireSession } from "@/server/auth/require-session";
import {
  getResearch,
  createResearch,
  publicResearch,
} from "@/server/repositories/deep-research.repository";
import { actOnResearch } from "@/server/chat/research";
import { notFound } from "@/server/db/errors";
import { jsonData } from "@/server/http/api-response";
import { queryOne } from "@/server/db/pool";
import { researchReportFile } from "@/server/chat/research-report";
import { readLiveTurn } from "@/server/chat/chat-coord-client";
import { parseDeepResearchPlan } from "@/lib/deep-research";
import { generationExecutionOrigin } from "@/server/chat/durable-generation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { chatId: string; toolId: string };
export const GET = withApiRouteParams<Params>(
  async ({ session, params, request }) => {
    const user = requireSession(session);
    const plan = await getResearch(params.chatId, params.toolId, user.id);
    if (!plan) throw notFound("Research plan not found.");
    let activity: { id: string; content: string; contentJson: unknown } | null =
      null;
    if (
      new URL(request.url).searchParams.get("activity") === "1" &&
      plan.assistant_message_id
    ) {
      const live =
        plan.status === "running" ? await readLiveTurn(plan.chat_id) : null;
      if (
        live?.userId === user.id &&
        live.assistantId === plan.assistant_message_id
      ) {
        activity = {
          id: live.assistantId,
          content: live.answer ?? "",
          contentJson: live.contentJson,
        };
      } else {
        activity = await queryOne(
          `select id,coalesce(content,'') content,content_json as "contentJson" from public.chat_messages where id=$1 and chat_id=$2 and user_id=$3`,
          [plan.assistant_message_id, plan.chat_id, user.id],
        );
      }
    }
    const file =
      plan.status === "complete" ? await researchReportFile(plan) : null;
    return Response.json(
      { data: { plan: publicResearch(plan), activity, reportReady: !!file } },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
  { requireAuth: true, requireChatAuth: true },
);
export const POST = withApiRouteParams<Params>(
  async ({ session, params, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      action: string;
      tasks?: unknown;
      title?: unknown;
    };
    let plan = await getResearch(params.chatId, params.toolId, user.id);
    // Old text plans are upgraded only on an explicit action. Opening history
    // never admits a job or creates an approval deadline.
    if (!plan && ["start", "edit", "cancel"].includes(body.action)) {
      const saved = await queryOne<{ content: string }>(
        `select content from public.chat_messages where chat_id=$1 and user_id=$2 and role='assistant' and (id::text=$3 or client_id=$3)`,
        [params.chatId, user.id, params.toolId],
      );
      const textPlan = saved ? parseDeepResearchPlan(saved.content) : null;
      if (textPlan)
        plan = await createResearch({
          chatId: params.chatId,
          userId: user.id,
          toolId: params.toolId,
          title: textPlan.title,
          tasks: textPlan.tasks,
          origin: generationExecutionOrigin(request.url),
        });
    }
    if (!plan) throw notFound("Research plan not found.");
    const updated = await actOnResearch(
      plan,
      body.action,
      body.tasks,
      body.title,
    );
    return jsonData({ plan: updated ? publicResearch(updated) : null });
  },
  { requireAuth: true, requireChatAuth: true },
);
