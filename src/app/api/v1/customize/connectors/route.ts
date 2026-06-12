import { withApiHandler } from "@/backend/http/api-handler"; // session + centralized error handling
import { jsonData } from "@/backend/http/api-response"; // { data } success JSON
import { requireSession } from "@/backend/auth/require-session"; // logged-in user id
import * as settingsRepo from "@/backend/repositories/settings.repository"; // getUserSettings / updateUserSettings
import { AppError } from "@/backend/db/errors"; // validation 400

export const runtime = "nodejs"; // Node.js — JSON settings column
export const dynamic = "force-dynamic";

type ConnectorInstall = {
  connectorId: string;
  status: string;
  connectedAt: string;
};

const ALLOWED_CONNECTOR_IDS = new Set(["github", "gmail", "calendar", "drive"]);

function parseConnectorId(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new AppError("connectorId must be a string.", 400);
  }
  const connectorId = raw.trim();
  if (!connectorId || connectorId.length > 64) {
    throw new AppError("connectorId is required.", 400);
  }
  if (!ALLOWED_CONNECTOR_IDS.has(connectorId)) {
    throw new AppError("Unknown connector.", 400);
  }
  return connectorId;
}

function readConnectors(
  settings: Record<string, unknown> | undefined,
): ConnectorInstall[] {
  const raw = settings?.connectors;
  if (!Array.isArray(raw)) return [];
  const out: ConnectorInstall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const connectorId =
      typeof row.connectorId === "string" ? row.connectorId.trim() : "";
    if (!connectorId || !ALLOWED_CONNECTOR_IDS.has(connectorId)) continue;
    const connectedAt =
      typeof row.connectedAt === "string"
        ? row.connectedAt
        : new Date(0).toISOString();
    const status = typeof row.status === "string" ? row.status : "active";
    out.push({ connectorId, status, connectedAt });
  }
  return out;
}

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const row = await settingsRepo.getUserSettings(user.id); // settings JSONB row
    const connectors = readConnectors(row?.settings); // parse connectors array
    return jsonData({ connectors }); // customize UI — connected apps list
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      connectorId?: unknown;
      revoke?: unknown;
    };
    const connectorId = parseConnectorId(body.connectorId);
    const revoke = body.revoke === true;

    const row = await settingsRepo.getUserSettings(user.id); // current settings snapshot
    const settings = (row?.settings ?? {}) as Record<string, unknown>; // merge base object
    const connectors = readConnectors(settings); // existing installs

    const next = revoke
      ? connectors.filter((c) => c.connectorId !== connectorId)
      : [
          ...connectors.filter((c) => c.connectorId !== connectorId),
          {
            connectorId,
            status: "active",
            connectedAt: new Date().toISOString(), // connect timestamp — UI "connected since"
          },
        ]; // upsert — same connectorId replace

    await settingsRepo.updateUserSettings(user.id, {
      settings: { ...settings, connectors: next },
    });

    return jsonData({ connectors: next }, revoke ? 200 : 201); // revoke → 200 OK, new install → 201
  },
  { requireAuth: true },
);
