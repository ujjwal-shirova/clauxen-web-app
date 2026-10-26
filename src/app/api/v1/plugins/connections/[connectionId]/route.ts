import { withApiRouteParams } from "@/server/http/route-params";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { AppError, notFound } from "@/server/db/errors";
import { connectionDto } from "@/server/plugins/connection-dto";
import { disconnectPlugin } from "@/server/plugins/plugin-connect";
import * as repo from "@/server/repositories/plugin-connections.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET    /api/v1/plugins/connections/:id — tools, resources, prompts, activity
 * PATCH  /api/v1/plugins/connections/:id — permission mode and tool toggles
 * DELETE /api/v1/plugins/connections/:id — revoke at the provider and forget
 */

export const GET = withApiRouteParams<{ connectionId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const connection = await repo.getConnectionForUser(params.connectionId, user.id);
    if (!connection || connection.status === "revoked") throw notFound("Connection not found.");

    const [tools, capabilities, activity] = await Promise.all([
      repo.listConnectionTools(connection.id, { includeDisabled: true }),
      repo.listCapabilities(connection.id),
      repo.listRecentToolCalls(connection.id, 20),
    ]);

    return jsonData({
      connection: connectionDto({ ...connection, tool_count: tools.length }),
      tools: tools.map((tool) => ({
        name: tool.tool_name,
        title: tool.title || tool.tool_name,
        description: tool.description,
        risk: tool.risk_level,
        enabled: tool.is_enabled,
      })),
      resources: capabilities
        .filter((item) => item.kind === "resource")
        .map(({ name, title, description, uri }) => ({ name, title, description, uri })),
      prompts: capabilities
        .filter((item) => item.kind === "prompt")
        .map(({ name, title, description }) => ({ name, title, description })),
      activity: activity.map((call) => ({
        id: call.id,
        tool: call.tool_name,
        risk: call.risk_level,
        status: call.status,
        detail: call.status === "blocked" ? call.detail : null,
        durationMs: call.duration_ms,
        at: call.created_at,
      })),
    });
  },
  { requireAuth: true },
);

export const PATCH = withApiRouteParams<{ connectionId: string }>(
  async ({ request, session, params }) => {
    const user = requireSession(session);
    const connection = await repo.getConnectionForUser(params.connectionId, user.id);
    if (!connection || connection.status === "revoked") throw notFound("Connection not found.");

    const body = (await request.json().catch(() => ({}))) as {
      permissionMode?: unknown;
      tools?: unknown;
    };

    if (body.permissionMode !== undefined) {
      if (body.permissionMode !== "read_only" && body.permissionMode !== "read_write") {
        throw new AppError("permissionMode must be read_only or read_write.", 400, "invalid_request");
      }
      await repo.setPermissionMode(connection.id, user.id, body.permissionMode);
    }

    if (body.tools !== undefined) {
      if (!body.tools || typeof body.tools !== "object" || Array.isArray(body.tools)) {
        throw new AppError("tools must map tool names to booleans.", 400, "invalid_request");
      }
      const known = new Set(
        (await repo.listConnectionTools(connection.id, { includeDisabled: true })).map(
          (tool) => tool.tool_name,
        ),
      );
      for (const [name, enabled] of Object.entries(body.tools as Record<string, unknown>)) {
        if (!known.has(name) || typeof enabled !== "boolean") continue;
        await repo.setToolEnabled(connection.id, name, enabled);
      }
    }

    const updated = await repo.getConnectionForUser(connection.id, user.id);
    return jsonData({ connection: updated ? connectionDto(updated) : null });
  },
  { requireAuth: true },
);

export const DELETE = withApiRouteParams<{ connectionId: string }>(
  async ({ session, params }) => {
    const user = requireSession(session);
    const connection = await repo.getConnectionForUser(params.connectionId, user.id);
    if (!connection || connection.status === "revoked") throw notFound("Connection not found.");
    await disconnectPlugin(connection, user.id);
    return jsonData({ ok: true, connectionId: connection.id });
  },
  { requireAuth: true },
);
