import { requireSession } from "@/server/auth/require-session";
import { AppError } from "@/server/db/errors";
import { query } from "@/server/db/pool";
import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CollectionRow = { plugin_id: string; created_at: string };

function normalizePluginId(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError("pluginId is required.", 400, "invalid_body");
  }
  const trimmed = value.trim().slice(0, 200);
  if (!trimmed) {
    throw new AppError("pluginId is required.", 400, "invalid_body");
  }
  return trimmed;
}

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const rows = await query<CollectionRow>(
      `select plugin_id, created_at
       from public.plugin_collections
       where user_id = $1::uuid
       order by created_at desc
       limit 500`,
      [user.id],
    );
    return jsonData({ pluginIds: rows.map((row) => row.plugin_id) });
  },
  { requireAuth: true },
);

export const POST = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new AppError("JSON object required.", 400, "invalid_json");
    }
    const pluginId = normalizePluginId(body.pluginId);
    await query(
      `insert into public.plugin_collections (user_id, plugin_id)
       values ($1::uuid, $2)
       on conflict do nothing`,
      [user.id, pluginId],
    );
    return jsonData({ pluginId, saved: true });
  },
  { requireAuth: true },
);

export const DELETE = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const url = new URL(request.url);
    const fromQuery = url.searchParams.get("pluginId");
    let pluginId: string | null = null;
    if (fromQuery) {
      pluginId = normalizePluginId(fromQuery);
    } else {
      try {
        const body = (await request.json()) as Record<string, unknown>;
        pluginId = normalizePluginId(body.pluginId);
      } catch {
        throw new AppError("pluginId is required.", 400, "invalid_body");
      }
    }
    await query(
      `delete from public.plugin_collections
       where user_id = $1::uuid and plugin_id = $2`,
      [user.id, pluginId],
    );
    return jsonData({ pluginId, saved: false });
  },
  { requireAuth: true },
);
