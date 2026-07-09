import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as securitySettingsService from "@/backend/services/security-settings.service";

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
