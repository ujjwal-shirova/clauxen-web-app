import postgres from "postgres";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  CHAT_HISTORY_CACHE?: KVNamespace;
  CHAT_ARCHIVES?: R2Bucket;
  CHAT_HISTORY_INTERNAL_TOKEN?: string;
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

type PagePayload = {
  messages: Omit<MessageRow, "has_more">[];
  nextCursor: { id: string; createdAt: string } | null;
  hasMore: boolean;
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,x-clauxen-internal",
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
): Promise<PagePayload> {
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

/** Ensure latest page opens on a complete user→assistant pair when possible. */
async function alignLatestPair(
  env: Env,
  input: { chatId: string; userId: string; limit: number },
  page: PagePayload,
): Promise<PagePayload> {
  if (
    page.messages[0]?.role === "user" ||
    !page.hasMore ||
    !page.nextCursor
  ) {
    return page;
  }
  const older = await fetchMessagesPage(env, {
    chatId: input.chatId,
    userId: input.userId,
    cursorCreatedAt: page.nextCursor.createdAt,
    cursorId: page.nextCursor.id,
    limit: input.limit,
  });
  const existing = new Set(page.messages.map((m) => m.id));
  const prepended = older.messages.filter((m) => !existing.has(m.id));
  return {
    messages: [...prepended, ...page.messages],
    nextCursor: older.nextCursor,
    hasMore: older.hasMore,
  };
}

function kvKey(userId: string, chatId: string, limit: number) {
  return `latest:${userId}:${chatId}:${limit}`;
}

function r2Key(userId: string, chatId: string, limit: number) {
  return `users/${userId}/chats/${chatId}/head/latest-${limit}.json`;
}

function cacheRequest(userId: string, chatId: string, limit: number) {
  return new Request(
    `https://chat-history.internal/latest/${userId}/${chatId}?limit=${limit}`,
    { method: "GET" },
  );
}

async function writeCaches(
  env: Env,
  ctx: ExecutionContext,
  input: {
    userId: string;
    chatId: string;
    limit: number;
    payload: PagePayload;
    cacheTtl: number;
  },
) {
  const { userId, chatId, limit, payload, cacheTtl } = input;
  const body = JSON.stringify(payload);

  if (env.CHAT_HISTORY_CACHE) {
    ctx.waitUntil(
      env.CHAT_HISTORY_CACHE.put(kvKey(userId, chatId, limit), body, {
        expirationTtl: Math.max(60, cacheTtl),
      }),
    );
  }

  if (env.CHAT_ARCHIVES) {
    ctx.waitUntil(
      env.CHAT_ARCHIVES.put(r2Key(userId, chatId, limit), body, {
        httpMetadata: { contentType: "application/json" },
      }),
    );
  }

  const response = json(
    { data: payload },
    200,
    { "cache-control": `private, max-age=${cacheTtl}` },
  );
  ctx.waitUntil(caches.default.put(cacheRequest(userId, chatId, limit), response));
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
        hyperdrive: Boolean(env.HYPERDRIVE?.connectionString || env.DATABASE_URL),
        kv: Boolean(env.CHAT_HISTORY_CACHE),
        r2: Boolean(env.CHAT_ARCHIVES),
      });
    }

    // Write-through warm — called by Next after a turn completes.
    if (url.pathname === "/internal/warm" && request.method === "POST") {
      const token =
        request.headers.get("x-clauxen-internal") ??
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (
        !env.CHAT_HISTORY_INTERNAL_TOKEN ||
        token !== env.CHAT_HISTORY_INTERNAL_TOKEN
      ) {
        return json({ error: "unauthorized" }, 401);
      }
      const body = (await request.json().catch(() => ({}))) as {
        userId?: string;
        chatId?: string;
        limit?: number;
      };
      if (!body.userId || !body.chatId) {
        return json({ error: "userId and chatId required" }, 400);
      }
      const limit = Math.min(50, Math.max(1, Number(body.limit ?? 2) || 2));
      const cacheTtl = Math.max(
        60,
        Number(env.LATEST_PAGE_CACHE_TTL_SECONDS ?? "120") || 120,
      );
      try {
        let page = await fetchMessagesPage(env, {
          chatId: body.chatId,
          userId: body.userId,
          cursorCreatedAt: null,
          cursorId: null,
          limit,
        });
        page = await alignLatestPair(
          env,
          { chatId: body.chatId, userId: body.userId, limit },
          page,
        );
        await writeCaches(env, ctx, {
          userId: body.userId,
          chatId: body.chatId,
          limit,
          payload: page,
          cacheTtl,
        });
        return json({ ok: true, hasMore: page.hasMore });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 500);
      }
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
      60,
      Number(env.LATEST_PAGE_CACHE_TTL_SECONDS ?? "120") || 120,
    );

    // L1: Cache API (no daily quota — primary spike shield)
    if (isLatestPage) {
      const hit = await caches.default.match(
        cacheRequest(user.sub, chatId, limit),
      );
      if (hit) {
        const headers = new Headers(hit.headers);
        headers.set("x-clauxen-cache", "cache-api-hit");
        return new Response(hit.body, { status: hit.status, headers });
      }

      // L2: KV pointer/payload
      if (env.CHAT_HISTORY_CACHE) {
        const cached = await env.CHAT_HISTORY_CACHE.get(
          kvKey(user.sub, chatId, limit),
          "json",
        );
        if (cached) {
          const response = json(
            { data: cached },
            200,
            {
              "cache-control": `private, max-age=${cacheTtl}`,
              "x-clauxen-cache": "kv-hit",
            },
          );
          ctx.waitUntil(
            caches.default.put(
              cacheRequest(user.sub, chatId, limit),
              response.clone(),
            ),
          );
          return response;
        }
      }

      // L3: R2 snapshot (high Class B budget on free tier)
      if (env.CHAT_ARCHIVES) {
        const obj = await env.CHAT_ARCHIVES.get(r2Key(user.sub, chatId, limit));
        if (obj) {
          const payload = await obj.json<PagePayload>();
          const response = json(
            { data: payload },
            200,
            {
              "cache-control": `private, max-age=${cacheTtl}`,
              "x-clauxen-cache": "r2-hit",
            },
          );
          ctx.waitUntil(writeCaches(env, ctx, {
            userId: user.sub,
            chatId,
            limit,
            payload,
            cacheTtl,
          }));
          return response;
        }
      }
    }

    try {
      let page = await fetchMessagesPage(env, {
        chatId,
        userId: user.sub,
        cursorCreatedAt,
        cursorId,
        limit,
      });

      if (isLatestPage) {
        page = await alignLatestPair(
          env,
          { chatId, userId: user.sub, limit },
          page,
        );
        ctx.waitUntil(
          writeCaches(env, ctx, {
            userId: user.sub,
            chatId,
            limit,
            payload: page,
            cacheTtl,
          }),
        );
      }

      return json(
        { data: page },
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
    } catch (error) {
      // Stale fallback — survive Hyperdrive/query spikes.
      if (isLatestPage && env.CHAT_HISTORY_CACHE) {
        const stale = await env.CHAT_HISTORY_CACHE.get(
          kvKey(user.sub, chatId, limit),
          "json",
        );
        if (stale) {
          return json(
            { data: stale },
            200,
            {
              "cache-control": "private, max-age=30",
              "x-clauxen-cache": "stale-fallback",
            },
          );
        }
      }
      if (isLatestPage && env.CHAT_ARCHIVES) {
        const obj = await env.CHAT_ARCHIVES.get(r2Key(user.sub, chatId, limit));
        if (obj) {
          const payload = await obj.json<PagePayload>();
          return json(
            { data: payload },
            200,
            {
              "cache-control": "private, max-age=30",
              "x-clauxen-cache": "stale-r2-fallback",
            },
          );
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      const status = /not found|not authenticated/i.test(message) ? 404 : 500;
      return json({ error: message }, status);
    }
  },
};
