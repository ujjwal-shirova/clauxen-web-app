import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import * as securitySettingsService from "@/server/services/security-settings.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const security = await securitySettingsService.getSecuritySettings(user.id);
    return jsonData({ security });
  },
  { requireAuth: true },
);
