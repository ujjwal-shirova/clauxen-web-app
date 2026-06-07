import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import { pauseSandbox } from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRouteParams<{ sandboxId: string }>(
  async ({ params }) => jsonData(await pauseSandbox(params.sandboxId)),
  { requireChatAuth: true },
);
