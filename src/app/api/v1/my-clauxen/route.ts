import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import * as myClauxenService from "@/server/services/my-clauxen.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const data = await myClauxenService.getMyClauxen(user.id);
    return jsonData({ myClauxen: data });
  },
  { requireAuth: true },
);

export const PATCH = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => null)) as {
      selfGrowthEnabled?: unknown;
    } | null;

    if (typeof body?.selfGrowthEnabled !== "boolean") {
      throw new AppError(
        "selfGrowthEnabled must be a boolean",
        400,
        "invalid_body",
      );
    }

    const data = await myClauxenService.setSelfGrowth(
      user.id,
      body.selfGrowthEnabled,
    );
    return jsonData({ myClauxen: data });
  },
  { requireAuth: true },
);
