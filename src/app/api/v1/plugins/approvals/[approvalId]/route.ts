import type { NextRequest } from "next/server";
import { withApiHandler } from "@/server/http/api-handler";
import { requireSession } from "@/server/auth/require-session";
import { jsonData } from "@/server/http/api-response";
import { assertMutationOrigin, readBoundedBody } from "@/server/plugins/oauth";
import { connectorError } from "@/server/plugins/crypto";
import { approveConnectorAction, withConnectorErrors } from "@/server/plugins/service";

export async function POST(request: NextRequest, context: { params: Promise<{ approvalId: string }> }) {
  return withApiHandler(async ({ request, session }) => {
    const user = requireSession(session);
    const { approvalId } = await context.params;
    return withConnectorErrors(async () => {
      assertMutationOrigin(request);
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw connectorError("Submit an approval decision as JSON.", 415);
      const body = JSON.parse(await readBoundedBody(new Response(request.body), 1024)) as Record<string, unknown>;
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !["approve", "reject"].includes(String(body.decision))) throw connectorError("Submit only an approve or reject decision.");
      const response = jsonData(await approveConnectorAction(user.id, approvalId, body.decision as "approve" | "reject"));
      response.headers.set("Cache-Control", "no-store");
      return response;
    });
  }, { requireAuth: true })(request);
}
