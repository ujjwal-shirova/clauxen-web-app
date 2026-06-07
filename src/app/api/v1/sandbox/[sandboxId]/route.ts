import { withApiRouteParams } from "@/backend/http/route-params";
import { jsonData } from "@/backend/http/api-response";
import {
  getSandboxInfo,
  killSandbox,
} from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRouteParams<{ sandboxId: string }>(
  async ({ params }) => {
    const info = await getSandboxInfo(params.sandboxId);
    return jsonData(info);
  },
  { requireChatAuth: true },
);

export const DELETE = withApiRouteParams<{ sandboxId: string }>(
  async ({ params }) => {
    const result = await killSandbox(params.sandboxId);
    return jsonData(result);
  },
  { requireChatAuth: true },
);
