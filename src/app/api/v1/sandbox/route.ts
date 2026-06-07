import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import {
  createSandbox,
  listSandboxes,
} from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withApiHandler(
  async ({ request, session }) => {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const sandboxes = await listSandboxes({
      userId: session?.id,
      state: state
        ? (state.split(",") as Array<"running" | "paused">)
        : ["running", "paused"],
    });
    return jsonData({ sandboxes });
  },
  { requireChatAuth: true },
);

export const POST = withApiHandler(
  async ({ request, session }) => {
    const body = (await request.json()) as {
      timeoutMs?: number;
      autoPause?: boolean;
      autoResume?: boolean;
      idleTimeoutSeconds?: number;
      conversationId?: string;
      metadata?: Record<string, string>;
    };

    const result = await createSandbox({
      userId: session?.id,
      conversationId: body.conversationId,
      timeoutMs: body.timeoutMs,
      autoPause: body.autoPause,
      autoResume: body.autoResume ?? true,
      idleTimeoutSeconds: body.idleTimeoutSeconds,
      metadata: body.metadata,
    });

    return jsonData(result.info);
  },
  { requireChatAuth: true },
);
