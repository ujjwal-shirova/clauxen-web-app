import { NextRequest } from "next/server";
import { isGenerationsInternalRequest } from "@/server/http/internal-generations-auth";
import { startResearch } from "@/server/chat/research";
import { withDatabaseRequest } from "@/server/db/pool";
export const runtime = "nodejs";
export const POST = (request: NextRequest) =>
  withDatabaseRequest(async () => {
    if (!isGenerationsInternalRequest(request))
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { researchPlanId } = (await request.json()) as {
      researchPlanId?: string;
    };
    if (!researchPlanId || !/^[0-9a-f-]{36}$/i.test(researchPlanId))
      return Response.json({ error: "Invalid plan" }, { status: 400 });
    const plan = await startResearch(researchPlanId);
    if (plan?.status === "pending")
      return Response.json({ error: "Not due" }, { status: 425 });
    return Response.json({ ok: true });
  });
