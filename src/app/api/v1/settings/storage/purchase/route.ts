import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import * as storageAddons from "@/server/services/storage-addons.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json().catch(() => null)) as {
      gigabytes?: unknown;
    } | null;
    if (!body || typeof body !== "object") {
      throw new AppError("Invalid request.", 400, "bad_request");
    }
    const result = await storageAddons.startStoragePurchase({
      userId: user.id,
      gigabytes: body.gigabytes,
    });
    return jsonData(result);
  },
  { requireAuth: true },
);
