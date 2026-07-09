import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as filesService from "@/backend/services/files.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const storage = await filesService.getUserStorageSummary(user.id);
    return jsonData({ storage });
  },
  { requireAuth: true },
);
