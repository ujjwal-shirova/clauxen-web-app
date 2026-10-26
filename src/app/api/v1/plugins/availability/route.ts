import { jsonData } from "@/server/http/api-response";
import { marketplaceCatalog } from "@/client/components/plugins/catalog";
import { connectorAvailability } from "@/server/plugins/connector-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/plugins/availability — which catalog plugins can connect. */
export function GET() {
  const availability = Object.fromEntries(
    Object.keys(marketplaceCatalog.plugins).map((pluginId) => {
      const entry = connectorAvailability(pluginId);
      return [
        pluginId,
        {
          available: entry.available,
          kind: entry.kind,
          providerLabel: entry.providerLabel,
          reason: entry.reason,
        },
      ];
    }),
  );
  return jsonData({ availability });
}
