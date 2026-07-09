import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as securitySettingsService from "@/backend/services/security-settings.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const connected = await securitySettingsService.listConnectedAccountsForUser(
      user.id,
    );
    return jsonData({
      accounts: connected.accounts,
      installations: connected.installations,
    });
  },
  { requireAuth: true },
);

export const DELETE = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      accountId?: string;
      installationId?: string;
    };
    const result = await securitySettingsService.disconnectAccount(user.id, {
      accountId: body.accountId,
      installationId: body.installationId,
    });
    return jsonData({ disconnected: result });
  },
  { requireAuth: true },
);
