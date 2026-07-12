import postgres from "postgres";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  /** Preferred: Hyperdrive binding to Supabase Postgres. */
  HYPERDRIVE?: Hyperdrive;
  /** Fallback when Hyperdrive is not bound (local / bootstrap). */
  DATABASE_URL?: string;
  /** Edge KV cache for latest message pages. */
  CHAT_HISTORY_CACHE?: KVNamespace;
  LATEST_PAGE_CACHE_TTL_SECONDS?: string;
}

type MessageRow = {
  id: string;
  chat_id: string;
  role: string;
  content: string;
  status: string;
  metadata: Record<string, unknown>;
  content_json: Record<string, unknown>;
  created_at: string;
  has_more: boolean;
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-max-age": "86400",
};

function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

async function verifySupabaseJwt(
  request: Request,
  env: Env,
): Promise<{ sub: string } | null> {
  const auth =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.slice(7).trim();
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ? { sub: user.id } : null;
}

function sqlClient(env: Env) {
  const connectionString =
    env.HYPERDRIVE?.connectionString || env.DATABASE_URL || "";
  if (!connectionString) {
    throw new Error("HYPERDRIVE or DATABASE_URL is required");
  }
  return postgres(connectionString, {
    max: 1,
    fetch_types: false,
    prepare: false,
  });
}

async function fetchMessagesPage(
  env: Env,
  input: {
    chatId: string;
    userId: string;
    cursorCreatedAt: string | null;
    cursorId: string | null;
    limit: number;
  },
) {
  const sql = sqlClient(env);
  try {
    const rows = (await sql`
      select id, chat_id, role, content, status, metadata, content_json, created_at, has_more
      from public.fetch_chat_messages_page(
        ${input.chatId},
        ${input.userId}::uuid,
        ${input.cursorCreatedAt}::timestamptz,
        ${input.cursorId}::uuid,
        ${input.limit}
      )
    `) as MessageRow[];

    const messages = rows.map(({ has_more: _h, ...message }) => message);
    const hasMore = rows.some((row) => row.has_more);
    const oldest = messages[0];
    const nextCursor =
      hasMore && oldest
        ? { id: oldest.id, createdAt: oldest.created_at }
        : null;

    return { messages, nextCursor, hasMore };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

function kvCacheKey(userId: string, chatId: string, limit: number) {
  return `latest:${userId}:${chatId}:${limit}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        hyperdrive: Boolean(env.HYPERDRIVE?.connectionString),
        kv: Boolean(env.CHAT_HISTORY_CACHE),
      });
    }

    const match = url.pathname.match(/^\/v1\/chats\/([^/]+)\/messages$/);
    if (!match || request.method !== "GET") {
      return json({ error: "not_found" }, 404);
    }

    const user = await verifySupabaseJwt(request, env);
    if (!user) return json({ error: "unauthorized" }, 401);

    const chatId = decodeURIComponent(match[1]!);
    const limit = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get("limit") ?? "2") || 2),
    );
    const cursorId = url.searchParams.get("cursor_id");
    const cursorCreatedAt = url.searchParams.get("cursor_created_at");
    const isLatestPage = !cursorId && !cursorCreatedAt;
    const cacheTtl = Math.max(
      1,
      Number(env.LATEST_PAGE_CACHE_TTL_SECONDS ?? "10") || 10,
    );

    const kvKey = kvCacheKey(user.sub, chatId, limit);

    if (isLatestPage && env.CHAT_HISTORY_CACHE) {
      const cached = await env.CHAT_HISTORY_CACHE.get(kvKey, "json");
      if (cached) {
        return json(
          { data: cached },
          200,
          {
            "cache-control": `private, max-age=${cacheTtl}`,
            "x-clauxen-cache": "kv-hit",
          },
        );
      }
    }

    // Secondary Cache API (edge) for same-colo hot reads.
    const cache = caches.default;
    const cacheKey = new Request(
      `https://chat-history.internal/latest/${user.sub}/${chatId}?limit=${limit}`,
      { method: "GET" },
    );
    if (isLatestPage) {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const headers = new Headers(hit.headers);
        headers.set("x-clauxen-cache", "cache-api-hit");
        return new Response(hit.body, { status: hit.status, headers });
      }
    }

    try {
      const page = await fetchMessagesPage(env, {
        chatId,
        userId: user.sub,
        cursorCreatedAt,
        cursorId,
        limit,
      });

      const payload = {
        messages: page.messages,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      };

      if (isLatestPage && env.CHAT_HISTORY_CACHE) {
        ctx.waitUntil(
          env.CHAT_HISTORY_CACHE.put(kvKey, JSON.stringify(payload), {
            expirationTtl: cacheTtl,
          }),
        );
      }

      const response = json(
        { data: payload },
        200,
        isLatestPage
          ? {
              "cache-control": `private, max-age=${cacheTtl}`,
              "x-clauxen-cache": "miss",
            }
          : {
              "cache-control": "private, no-store",
              "x-clauxen-cache": "bypass",
            },
      );

      if (isLatestPage) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /not found|not authenticated/i.test(message) ? 404 : 500;
      return json({ error: message }, status);
    }
  },
};
