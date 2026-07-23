import postgres from "postgres";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  HYPERDRIVE?: Hyperdrive;
  /** Optional second Hyperdrive with caching disabled for write-path reads. */
  HYPERDRIVE_FRESH?: Hyperdrive;
  DATABASE_URL?: string;
  CHAT_HISTORY_CACHE?: KVNamespace;
  CHAT_ARCHIVES?: R2Bucket;
  /** CF Queues producer for non-blocking warm + R2 archive. */
  HISTORY_JOBS?: Queue<HistoryJobMessage>;
  CHAT_HISTORY_INTERNAL_TOKEN?: string;
  LATEST_PAGE_CACHE_TTL_SECONDS?: string;
  CURSOR_PAGE_CACHE_TTL_SECONDS?: string;
  CHAT_LIST_CACHE_TTL_SECONDS?: string;
  JWT_CACHE_TTL_SECONDS?: string;
  APP_ORIGIN?: string;
}

type HistoryJobMessage = {
  type: "warm_and_archive";
  userId: string;
  chatId: string;
  limit?: number;
  limits?: number[];
};

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

type ChatListItem = {
  id: string;
  name: string;
  projectId: string | null;
  starred: boolean;
  pinned: boolean;
  updatedAt: string;
};

function originMatchesRule(origin: string, rule: string): boolean {
  if (rule === origin) return true;
  if (!rule.startsWith("https://*.")) return false;
  try {
    const originUrl = new URL(origin);
    const suffix = rule.slice("https://*.".length);
    return (
      originUrl.protocol === "https:" &&
      originUrl.hostname.endsWith(`.${suffix}`) &&
      originUrl.hostname !== suffix
    );
  } catch {
    return false;
  }
}

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = (env.APP_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin =
    allowed.length === 0
      ? "*"
      : allowed.some((rule) => originMatchesRule(origin, rule))
        ? origin
        : allowed[0]!;

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers":
      "authorization,content-type,x-clauxen-internal",
    "access-control-max-age": "86400",
    vary: "origin, authorization",
  };
}

function json(
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
  cors?: Record<string, string>,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...(cors ?? {}),
      ...extraHeaders,
    },
  });
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify Supabase JWT with a short Cache API memo (same colo) so sidebar +
 * message hydrates don't re-hit Auth on every parallel request.
 */
async function verifySupabaseJwt(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<{ sub: string } | null> {
  const auth =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.slice(7).trim();
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

  const jwtTtl = Math.max(
    30,
    Math.min(300, Number(env.JWT_CACHE_TTL_SECONDS ?? "60") || 60),
  );
  const digest = await hashToken(token);
  const cacheReq = new Request(
    `https://chat-history.internal/jwt/${digest}`,
    { method: "GET" },
  );

  const cached = await caches.default.match(cacheReq);
  if (cached?.ok) {
    const body = (await cached.json()) as { sub?: string };
    if (body.sub) return { sub: body.sub };
  }

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  if (!user.id) return null;

  ctx.waitUntil(
    caches.default.put(
      cacheReq,
      json(
        { sub: user.id },
        200,
        {
          "cache-control": `private, max-age=${jwtTtl}`,
          "x-clauxen-cache": "jwt-warm",
        },
      ),
    ),
  );

  return { sub: user.id };
}

function sqlClient(env: Env, fresh = false) {
  const connectionString =
    (fresh
      ? env.HYPERDRIVE_FRESH?.connectionString
      : undefined) ||
    env.HYPERDRIVE?.connectionString ||
    env.DATABASE_URL ||
    "";
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
  // Chat history must be read-after-write consistent. Worker Cache/KV provides
  // the controlled fast path; a miss must not reintroduce stale Hyperdrive SQL.
  const sql = sqlClient(env, true);
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

async function fetchChatList(
  env: Env,
  input: { userId: string; projectId: string | null; limit: number },
): Promise<ChatListItem[]> {
  const sql = sqlClient(env, true);
  try {
    const chats = input.projectId
      ? await sql`
          select id, title, project_id, starred, updated_at
          from public.chats
          where user_id = ${input.userId}::uuid
            and status != 'deleted'
            and project_id = ${input.projectId}
          order by updated_at desc
          limit ${input.limit}
        `
      : await sql`
          select id, title, project_id, starred, updated_at
          from public.chats
          where user_id = ${input.userId}::uuid
            and status != 'deleted'
          order by updated_at desc
          limit ${input.limit}
        `;

    const pinned = await sql`
      select chat_id
      from public.pinned_chats
      where user_id = ${input.userId}::uuid
    `;
    const pinnedRows = pinned as unknown as { chat_id: string }[];
    const pinnedIds = new Set(pinnedRows.map((p) => p.chat_id));

    const chatRows = chats as unknown as Array<{
      id: string;
      title: string;
      project_id: string | null;
      starred: boolean;
      updated_at: string;
    }>;

    return chatRows.map((chat) => ({
      id: chat.id,
      name: chat.title,
      projectId: chat.project_id,
      starred: Boolean(chat.starred),
      pinned: pinnedIds.has(chat.id),
      updatedAt: chat.updated_at,
    }));
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function alignLatestPair(
  env: Env,
  input: { chatId: string; userId: string; limit: number },
  page: PagePayload,
): Promise<PagePayload> {
  let aligned = page;
  // A large assistant/tool tail can span several pages. Keep walking until a
  // user turn anchors the visible tail, rather than producing an orphaned
  // assistant after a fresh hydrate.
  for (
    let pageCount = 0;
    pageCount < 10 &&
    aligned.messages[0]?.role !== "user" &&
    aligned.hasMore &&
    aligned.nextCursor;
    pageCount += 1
  ) {
    const older = await fetchMessagesPage(env, {
      chatId: input.chatId,
      userId: input.userId,
      cursorCreatedAt: aligned.nextCursor.createdAt,
      cursorId: aligned.nextCursor.id,
      limit: input.limit,
    });
    const existing = new Set(aligned.messages.map((message) => message.id));
    aligned = {
      messages: [
        ...older.messages.filter((message) => !existing.has(message.id)),
        ...aligned.messages,
      ],
      nextCursor: older.nextCursor,
      hasMore: older.hasMore,
    };
  }
  return aligned;
}

function kvKey(userId: string, chatId: string, limit: number) {
  return `latest:${userId}:${chatId}:${limit}`;
}

function pageKvKey(
  userId: string,
  chatId: string,
  limit: number,
  cursorId: string | null,
  cursorCreatedAt: string | null,
) {
  return `page:${userId}:${chatId}:${limit}:${cursorCreatedAt ?? ""}:${cursorId ?? ""}`;
}

function listKvKey(userId: string, projectId: string | null, limit: number) {
  return `list:${userId}:${projectId ?? ""}:${limit}`;
}

function cacheRequest(userId: string, chatId: string, limit: number) {
  return new Request(
    `https://chat-history.internal/latest/${userId}/${chatId}?limit=${limit}`,
    { method: "GET" },
  );
}

function pageCacheRequest(
  userId: string,
  chatId: string,
  limit: number,
  cursorId: string | null,
  cursorCreatedAt: string | null,
) {
  const qs = new URLSearchParams({
    limit: String(limit),
    cursor_id: cursorId ?? "",
    cursor_created_at: cursorCreatedAt ?? "",
  });
  return new Request(
    `https://chat-history.internal/page/${userId}/${chatId}?${qs}`,
    { method: "GET" },
  );
}

function listCacheRequest(
  userId: string,
  projectId: string | null,
  limit: number,
) {
  return new Request(
    `https://chat-history.internal/list/${userId}?project=${projectId ?? ""}&limit=${limit}`,
    { method: "GET" },
  );
}

function archiveObjectKey(
  userId: string,
  chatId: string,
  limit: number,
  cursorId: string | null,
  cursorCreatedAt: string | null,
): string {
  if (!cursorId && !cursorCreatedAt) {
    return `archives/${userId}/${chatId}/latest-${limit}.json`;
  }
  const cursor = `${cursorCreatedAt ?? ""}:${cursorId ?? ""}`;
  return `archives/${userId}/${chatId}/page-${limit}-${encodeURIComponent(cursor)}.json`;
}

async function writeR2Archive(
  env: Env,
  input: {
    userId: string;
    chatId: string;
    limit: number;
    cursorId?: string | null;
    cursorCreatedAt?: string | null;
    payload: PagePayload;
  },
): Promise<void> {
  if (!env.CHAT_ARCHIVES) return;
  const key = archiveObjectKey(
    input.userId,
    input.chatId,
    input.limit,
    input.cursorId ?? null,
    input.cursorCreatedAt ?? null,
  );
  await env.CHAT_ARCHIVES.put(key, JSON.stringify(input.payload), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      userId: input.userId,
      chatId: input.chatId,
      limit: String(input.limit),
    },
  });
}

async function readR2Archive(
  env: Env,
  input: {
    userId: string;
    chatId: string;
    limit: number;
    cursorId: string | null;
    cursorCreatedAt: string | null;
  },
): Promise<PagePayload | null> {
  if (!env.CHAT_ARCHIVES) return null;
  const key = archiveObjectKey(
    input.userId,
    input.chatId,
    input.limit,
    input.cursorId,
    input.cursorCreatedAt,
  );
  const obj = await env.CHAT_ARCHIVES.get(key);
  if (!obj) return null;
  try {
    return (await obj.json()) as PagePayload;
  } catch {
    return null;
  }
}

async function invalidateChatCaches(
  env: Env,
  input: { userId: string; chatId: string; limits?: number[] },
) {
  const limits = input.limits ?? [2, 10, 20, 50, 80, 100, 200, 500];
  const tasks: Promise<unknown>[] = [];

  for (const limit of limits) {
    tasks.push(
      caches.default.delete(cacheRequest(input.userId, input.chatId, limit)),
    );
    if (env.CHAT_HISTORY_CACHE) {
      tasks.push(
        env.CHAT_HISTORY_CACHE.delete(kvKey(input.userId, input.chatId, limit)),
      );
    }
    // Drop cold R2 latest pages so warm/archive rewrites don't serve stale SoR.
    if (env.CHAT_ARCHIVES) {
      tasks.push(
        env.CHAT_ARCHIVES.delete(
          archiveObjectKey(input.userId, input.chatId, limit, null, null),
        ),
      );
    }
  }

  // Sidebar list is stale after message/title changes.
  for (const limit of [50, 100]) {
    tasks.push(caches.default.delete(listCacheRequest(input.userId, null, limit)));
    if (env.CHAT_HISTORY_CACHE) {
      tasks.push(
        env.CHAT_HISTORY_CACHE.delete(listKvKey(input.userId, null, limit)),
      );
    }
  }

  await Promise.allSettled(tasks);
}

async function invalidateListCaches(env: Env, userId: string) {
  const tasks: Promise<unknown>[] = [];
  for (const limit of [50, 100]) {
    tasks.push(caches.default.delete(listCacheRequest(userId, null, limit)));
    if (env.CHAT_HISTORY_CACHE) {
      tasks.push(env.CHAT_HISTORY_CACHE.delete(listKvKey(userId, null, limit)));
    }
  }
  await Promise.allSettled(tasks);
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
    cors: Record<string, string>;
  },
) {
  const { userId, chatId, limit, payload, cacheTtl, cors } = input;
  const body = JSON.stringify(payload);

  if (env.CHAT_HISTORY_CACHE) {
    ctx.waitUntil(
      env.CHAT_HISTORY_CACHE.put(kvKey(userId, chatId, limit), body, {
        expirationTtl: Math.max(60, cacheTtl),
      }),
    );
  }

  ctx.waitUntil(
    writeR2Archive(env, {
      userId,
      chatId,
      limit,
      payload,
    }),
  );

  const response = json(
    { data: payload },
    200,
    {
      "cache-control": `private, max-age=${cacheTtl}, stale-while-revalidate=${Math.max(60, Math.floor(cacheTtl / 2))}`,
      "cache-tag": `chat:${chatId},user:${userId}`,
      "x-clauxen-cache": "warm-write",
    },
    cors,
  );
  ctx.waitUntil(caches.default.put(cacheRequest(userId, chatId, limit), response));
}

async function writePageCaches(
  env: Env,
  ctx: ExecutionContext,
  input: {
    userId: string;
    chatId: string;
    limit: number;
    cursorId: string | null;
    cursorCreatedAt: string | null;
    payload: PagePayload;
    cacheTtl: number;
    cors: Record<string, string>;
  },
) {
  const body = JSON.stringify(input.payload);
  const key = pageKvKey(
    input.userId,
    input.chatId,
    input.limit,
    input.cursorId,
    input.cursorCreatedAt,
  );

  if (env.CHAT_HISTORY_CACHE) {
    ctx.waitUntil(
      env.CHAT_HISTORY_CACHE.put(key, body, {
        expirationTtl: Math.max(60, input.cacheTtl),
      }),
    );
  }

  ctx.waitUntil(
    writeR2Archive(env, {
      userId: input.userId,
      chatId: input.chatId,
      limit: input.limit,
      cursorId: input.cursorId,
      cursorCreatedAt: input.cursorCreatedAt,
      payload: input.payload,
    }),
  );

  const response = json(
    { data: input.payload },
    200,
    {
      "cache-control": `private, max-age=${input.cacheTtl}, stale-while-revalidate=${Math.max(30, Math.floor(input.cacheTtl / 2))}`,
      "cache-tag": `chat:${input.chatId},user:${input.userId}`,
      "x-clauxen-cache": "page-warm-write",
    },
    input.cors,
  );
  ctx.waitUntil(
    caches.default.put(
      pageCacheRequest(
        input.userId,
        input.chatId,
        input.limit,
        input.cursorId,
        input.cursorCreatedAt,
      ),
      response,
    ),
  );
}

async function writeListCaches(
  env: Env,
  ctx: ExecutionContext,
  input: {
    userId: string;
    projectId: string | null;
    limit: number;
    chats: ChatListItem[];
    cacheTtl: number;
    cors: Record<string, string>;
  },
) {
  const body = JSON.stringify(input.chats);
  if (env.CHAT_HISTORY_CACHE) {
    ctx.waitUntil(
      env.CHAT_HISTORY_CACHE.put(
        listKvKey(input.userId, input.projectId, input.limit),
        body,
        { expirationTtl: Math.max(60, input.cacheTtl) },
      ),
    );
  }
  const response = json(
    { data: { chats: input.chats } },
    200,
    {
      "cache-control": `private, max-age=${input.cacheTtl}, stale-while-revalidate=${Math.max(30, Math.floor(input.cacheTtl / 2))}`,
      "x-clauxen-cache": "list-warm-write",
    },
    input.cors,
  );
  ctx.waitUntil(
    caches.default.put(
      listCacheRequest(input.userId, input.projectId, input.limit),
      response,
    ),
  );
}

function requireInternal(request: Request, env: Env): boolean {
  const token =
    request.headers.get("x-clauxen-internal") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(
    env.CHAT_HISTORY_INTERNAL_TOKEN &&
      token === env.CHAT_HISTORY_INTERNAL_TOKEN,
  );
}

async function warmAndArchiveChat(
  env: Env,
  ctx: ExecutionContext,
  input: {
    userId: string;
    chatId: string;
    limits: number[];
    cors?: Record<string, string>;
  },
): Promise<number[]> {
  const cors = input.cors ?? {};
  const limits = input.limits
    .map((n) => Math.min(500, Math.max(1, Number(n) || 500)))
    .filter((v, i, a) => a.indexOf(v) === i);

  const cacheTtl = Math.max(
    60,
    Number(env.LATEST_PAGE_CACHE_TTL_SECONDS ?? "1800") || 1800,
  );

  // A warm represents a completed write. Remove every previous latest
  // page before fetching via the cache-disabled Hyperdrive binding.
  await invalidateChatCaches(env, {
    userId: input.userId,
    chatId: input.chatId,
  });
  for (const limit of limits) {
    let page = await fetchMessagesPage(env, {
      chatId: input.chatId,
      userId: input.userId,
      cursorCreatedAt: null,
      cursorId: null,
      limit,
    });
    page = await alignLatestPair(
      env,
      { chatId: input.chatId, userId: input.userId, limit },
      page,
    );
    await writeCaches(env, ctx, {
      userId: input.userId,
      chatId: input.chatId,
      limit,
      payload: page,
      cacheTtl,
      cors,
    });
  }
  const chats = await fetchChatList(env, {
    userId: input.userId,
    projectId: null,
    limit: 50,
  });
  const listTtl = Math.max(
    60,
    Number(env.CHAT_LIST_CACHE_TTL_SECONDS ?? "120") || 120,
  );
  await writeListCaches(env, ctx, {
    userId: input.userId,
    projectId: null,
    limit: 50,
    chats,
    cacheTtl: listTtl,
    cors,
  });
  return limits;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const cors = corsHeaders(env, request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json(
        {
          ok: true,
          hyperdrive: Boolean(
            env.HYPERDRIVE?.connectionString || env.DATABASE_URL,
          ),
          hyperdriveFresh: Boolean(env.HYPERDRIVE_FRESH?.connectionString),
          kv: Boolean(env.CHAT_HISTORY_CACHE),
          r2: Boolean(env.CHAT_ARCHIVES),
          queues: Boolean(env.HISTORY_JOBS),
          placement: "aws:us-west-1",
        },
        200,
        undefined,
        cors,
      );
    }

    if (url.pathname === "/internal/enqueue" && request.method === "POST") {
      if (!requireInternal(request, env)) {
        return json({ error: "unauthorized" }, 401, undefined, cors);
      }
      const body = (await request.json().catch(() => ({}))) as Partial<HistoryJobMessage>;
      if (!body.userId || !body.chatId) {
        return json({ error: "userId and chatId required" }, 400, undefined, cors);
      }
      if (!env.HISTORY_JOBS) {
        return json({ error: "queues_unavailable" }, 503, undefined, cors);
      }
      const limits = (
        body.limits?.length
          ? body.limits
          : [body.limit ?? 80, 80, 500]
      )
        .map((n) => Math.min(500, Math.max(1, Number(n) || 80)))
        .filter((v, i, a) => a.indexOf(v) === i);
      await env.HISTORY_JOBS.send({
        type: "warm_and_archive",
        userId: body.userId,
        chatId: body.chatId,
        limit: body.limit,
        limits,
      });
      return json({ ok: true, enqueued: true, limits }, 202, undefined, cors);
    }

    if (url.pathname === "/internal/warm" && request.method === "POST") {
      if (!requireInternal(request, env)) {
        return json({ error: "unauthorized" }, 401, undefined, cors);
      }
      const body = (await request.json().catch(() => ({}))) as {
        userId?: string;
        chatId?: string;
        limit?: number;
        limits?: number[];
      };
      if (!body.userId || !body.chatId) {
        return json({ error: "userId and chatId required" }, 400, undefined, cors);
      }
      const limits = (
        body.limits?.length
          ? body.limits
          : [body.limit ?? 500, 500]
      )
        .map((n) => Math.min(500, Math.max(1, Number(n) || 500)))
        .filter((v, i, a) => a.indexOf(v) === i);

      try {
        const warmed = await warmAndArchiveChat(env, ctx, {
          userId: body.userId,
          chatId: body.chatId,
          limits,
          cors,
        });
        return json({ ok: true, limits: warmed }, 200, undefined, cors);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 500, undefined, cors);
      }
    }

    if (url.pathname === "/internal/invalidate" && request.method === "POST") {
      if (!requireInternal(request, env)) {
        return json({ error: "unauthorized" }, 401, undefined, cors);
      }
      const body = (await request.json().catch(() => ({}))) as {
        userId?: string;
        chatId?: string;
        listsOnly?: boolean;
      };
      if (!body.userId) {
        return json({ error: "userId required" }, 400, undefined, cors);
      }
      if (body.listsOnly || !body.chatId) {
        await invalidateListCaches(env, body.userId);
      } else {
        await invalidateChatCaches(env, {
          userId: body.userId,
          chatId: body.chatId,
        });
      }
      return json({ ok: true }, 200, undefined, cors);
    }

    // Sidebar chat list — Cache API → KV → Hyperdrive
    if (url.pathname === "/v1/chats" && request.method === "GET") {
      const user = await verifySupabaseJwt(request, env, ctx);
      if (!user) return json({ error: "unauthorized" }, 401, undefined, cors);

      const projectId = url.searchParams.get("projectId");
      const limit = Math.min(
        100,
        Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50),
      );
      const listTtl = Math.max(
        60,
        Number(env.CHAT_LIST_CACHE_TTL_SECONDS ?? "120") || 120,
      );

      const listHit = await caches.default.match(
        listCacheRequest(user.sub, projectId, limit),
      );
      if (listHit) {
        const headers = new Headers(listHit.headers);
        headers.set("x-clauxen-cache", "list-cache-api");
        for (const [k, v] of Object.entries(cors)) headers.set(k, v);
        return new Response(listHit.body, { status: listHit.status, headers });
      }

      if (env.CHAT_HISTORY_CACHE) {
        const cached = await env.CHAT_HISTORY_CACHE.get(
          listKvKey(user.sub, projectId, limit),
          "json",
        );
        if (cached) {
          const response = json(
            { data: { chats: cached } },
            200,
            {
              "cache-control": `private, max-age=${listTtl}`,
              "x-clauxen-cache": "list-kv",
            },
            cors,
          );
          ctx.waitUntil(
            caches.default.put(
              listCacheRequest(user.sub, projectId, limit),
              response.clone(),
            ),
          );
          return response;
        }
      }

      try {
        const chats = await fetchChatList(env, {
          userId: user.sub,
          projectId,
          limit,
        });
        ctx.waitUntil(
          writeListCaches(env, ctx, {
            userId: user.sub,
            projectId,
            limit,
            chats,
            cacheTtl: listTtl,
            cors,
          }),
        );
        return json(
          { data: { chats } },
          200,
          {
            "cache-control": `private, max-age=${listTtl}`,
            "x-clauxen-cache": "list-hyperdrive",
          },
          cors,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 500, undefined, cors);
      }
    }

    const match = url.pathname.match(/^\/v1\/chats\/([^/]+)\/messages$/);
    if (!match || request.method !== "GET") {
      return json({ error: "not_found" }, 404, undefined, cors);
    }

    const user = await verifySupabaseJwt(request, env, ctx);
    if (!user) return json({ error: "unauthorized" }, 401, undefined, cors);

    const chatId = decodeURIComponent(match[1]!);
    const limit = Math.min(
      500,
      Math.max(1, Number(url.searchParams.get("limit") ?? "500") || 500),
    );
    const cursorId = url.searchParams.get("cursor_id");
    const cursorCreatedAt = url.searchParams.get("cursor_created_at");
    const isLatestPage = !cursorId && !cursorCreatedAt;
    const cacheTtl = Math.max(
      60,
      Number(env.LATEST_PAGE_CACHE_TTL_SECONDS ?? "1800") || 1800,
    );
    const cursorTtl = Math.max(
      60,
      Number(env.CURSOR_PAGE_CACHE_TTL_SECONDS ?? "300") || 300,
    );

    if (isLatestPage) {
      const hit = await caches.default.match(
        cacheRequest(user.sub, chatId, limit),
      );
      if (hit) {
        const headers = new Headers(hit.headers);
        headers.set("x-clauxen-cache", "cache-api");
        for (const [k, v] of Object.entries(cors)) headers.set(k, v);
        return new Response(hit.body, { status: hit.status, headers });
      }

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
              "cache-control": `private, max-age=${cacheTtl}, stale-while-revalidate=${Math.max(60, Math.floor(cacheTtl / 2))}`,
              "cache-tag": `chat:${chatId},user:${user.sub}`,
              "x-clauxen-cache": "kv",
            },
            cors,
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

      const r2Latest = await readR2Archive(env, {
        userId: user.sub,
        chatId,
        limit,
        cursorId: null,
        cursorCreatedAt: null,
      });
      if (r2Latest) {
        const response = json(
          { data: r2Latest },
          200,
          {
            "cache-control": `private, max-age=${cacheTtl}, stale-while-revalidate=${Math.max(60, Math.floor(cacheTtl / 2))}`,
            "cache-tag": `chat:${chatId},user:${user.sub}`,
            "x-clauxen-cache": "r2",
          },
          cors,
        );
        ctx.waitUntil(
          writeCaches(env, ctx, {
            userId: user.sub,
            chatId,
            limit,
            payload: r2Latest,
            cacheTtl,
            cors,
          }),
        );
        return response;
      }
    } else {
      const pageHit = await caches.default.match(
        pageCacheRequest(user.sub, chatId, limit, cursorId, cursorCreatedAt),
      );
      if (pageHit) {
        const headers = new Headers(pageHit.headers);
        headers.set("x-clauxen-cache", "page-cache-api");
        for (const [k, v] of Object.entries(cors)) headers.set(k, v);
        return new Response(pageHit.body, {
          status: pageHit.status,
          headers,
        });
      }
      if (env.CHAT_HISTORY_CACHE) {
        const cached = await env.CHAT_HISTORY_CACHE.get(
          pageKvKey(user.sub, chatId, limit, cursorId, cursorCreatedAt),
          "json",
        );
        if (cached) {
          return json(
            { data: cached },
            200,
            {
              "cache-control": `private, max-age=${cursorTtl}`,
              "x-clauxen-cache": "page-kv",
            },
            cors,
          );
        }
      }

      const r2Page = await readR2Archive(env, {
        userId: user.sub,
        chatId,
        limit,
        cursorId,
        cursorCreatedAt,
      });
      if (r2Page) {
        const response = json(
          { data: r2Page },
          200,
          {
            "cache-control": `private, max-age=${cursorTtl}`,
            "x-clauxen-cache": "r2-page",
          },
          cors,
        );
        ctx.waitUntil(
          writePageCaches(env, ctx, {
            userId: user.sub,
            chatId,
            limit,
            cursorId,
            cursorCreatedAt,
            payload: r2Page,
            cacheTtl: cursorTtl,
            cors,
          }),
        );
        return response;
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
            cors,
          }),
        );
      } else {
        ctx.waitUntil(
          writePageCaches(env, ctx, {
            userId: user.sub,
            chatId,
            limit,
            cursorId,
            cursorCreatedAt,
            payload: page,
            cacheTtl: cursorTtl,
            cors,
          }),
        );
      }

      return json(
        { data: page },
        200,
        isLatestPage
          ? {
              "cache-control": `private, max-age=${cacheTtl}`,
              "x-clauxen-cache": "hyperdrive",
            }
          : {
              "cache-control": `private, max-age=${cursorTtl}`,
              "x-clauxen-cache": "hyperdrive-page",
            },
        cors,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /not found|not authenticated/i.test(message) ? 404 : 500;
      return json({ error: message }, status, undefined, cors);
    }
  },

  async queue(
    batch: MessageBatch<HistoryJobMessage>,
    env: Env,
    ctx: ExecutionContext,
  ) {
    for (const msg of batch.messages) {
      try {
        const body = msg.body;
        if (body?.type !== "warm_and_archive" || !body.userId || !body.chatId) {
          msg.ack();
          continue;
        }
        const limits = (
          body.limits?.length
            ? body.limits
            : [body.limit ?? 80, 80, 500]
        )
          .map((n) => Math.min(500, Math.max(1, Number(n) || 80)))
          .filter((v, i, a) => a.indexOf(v) === i);
        await warmAndArchiveChat(env, ctx, {
          userId: body.userId,
          chatId: body.chatId,
          limits,
        });
        msg.ack();
      } catch (error) {
        console.error("[chat-history] queue job failed", error);
        msg.retry();
      }
    }
  },
};
