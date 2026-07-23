import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import {
  createSandbox,
  listSandboxes,
} from "@/backend/sandbox/sandbox-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withApiHandler(
  async ({ request, session }) => {
    const user = requireSession(session);
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const sandboxes = await listSandboxes({
      userId: user.id,
      state: state
        ? (state.split(",") as Array<"running" | "paused">)
        : ["running", "paused"],
    });
    return jsonData({ sandboxes });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ request, session }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      timeoutMs?: number;
      autoPause?: boolean;
      autoResume?: boolean;
      idleTimeoutSeconds?: number;
      conversationId?: string;
      metadata?: Record<string, string>;
    };

    // Never trust client-supplied ownership metadata.
    const safeMetadata = { ...(body.metadata ?? {}) };
    delete safeMetadata.userId;

    const result = await createSandbox({
      userId: user.id,
      conversationId: body.conversationId,
      timeoutMs: body.timeoutMs,
      autoPause: body.autoPause,
      autoResume: body.autoResume ?? true,
      idleTimeoutSeconds: body.idleTimeoutSeconds,
      metadata: safeMetadata,
    });

    return jsonData(result.info);
  },
  { requireAuth: true },
);
