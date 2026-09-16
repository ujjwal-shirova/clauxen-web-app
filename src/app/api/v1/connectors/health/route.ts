import { requireSession } from "@/server/auth/require-session";
import { env } from "@/server/config/env";
import {
  connectorGatewayConfigured,
} from "@/connectors/server/gateway";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    requireSession(session);
    const configured = connectorGatewayConfigured();
    let reachable = false;
    let status: number | null = null;
    if (configured) {
      try {
        const response = await fetch(`${env.connectorGatewayUrl}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        status = response.status;
        reachable = response.ok;
      } catch {
        reachable = false;
      }
    }
    return jsonData({
      mode: configured ? "gateway" : "local",
      gatewayUrl: env.connectorGatewayUrl,
      gatewayConfigured: configured,
      gatewayReachable: reachable,
      gatewayStatus: status,
    });
  },
  { requireAuth: true },
);
