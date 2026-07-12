import postgres from "postgres";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  /** Preferred: Hyperdrive binding to Supabase Postgres. */
  HYPERDRIVE?: Hyperdrive;
  /** Fallback when Hyperdrive is not bound (local / bootstrap). */
  DATABASE_URL?: string;
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

function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,OPTIONS",
          "access-control-allow-headers": "authorization,content-type",
        },
      });
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
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

    const cache = caches.default;
    const cacheKey = new Request(
      `https://chat-history.internal/latest/${user.sub}/${chatId}?limit=${limit}`,
      { method: "GET" },
    );

    if (isLatestPage) {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    }

    try {
      const page = await fetchMessagesPage(env, {
        chatId,
        userId: user.sub,
        cursorCreatedAt,
        cursorId,
        limit,
      });

      const response = json(
        {
          data: {
            messages: page.messages,
            nextCursor: page.nextCursor,
            hasMore: page.hasMore,
          },
        },
        200,
        isLatestPage
          ? {
              "cache-control": `private, max-age=${cacheTtl}`,
            }
          : {
              "cache-control": "private, no-store",
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
