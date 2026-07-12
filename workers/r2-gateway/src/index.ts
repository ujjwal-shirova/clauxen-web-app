export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  IMAGES: R2Bucket;
  DOCUMENTS: R2Bucket;
  ARTIFACTS: R2Bucket;
  USER_FILES: R2Bucket;
}

type BucketBinding = keyof Pick<
  Env,
  "IMAGES" | "DOCUMENTS" | "ARTIFACTS" | "USER_FILES"
>;

function bucketForName(env: Env, name: string): R2Bucket | null {
  const map: Record<string, R2Bucket> = {
    images: env.IMAGES,
    documents: env.DOCUMENTS,
    artifacts: env.ARTIFACTS,
    "user-files": env.USER_FILES,
    "clauxen-images": env.IMAGES,
    "clauxen-documents": env.DOCUMENTS,
    "clauxen-artifacts": env.ARTIFACTS,
  };
  return map[name.toLowerCase()] ?? null;
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

function json(data: unknown, status = 200, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
          "access-control-allow-headers": "authorization,content-type",
        },
      });
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    const user = await verifySupabaseJwt(request, env);
    if (!user && url.pathname !== "/download/public") {
      return json({ error: "Unauthorized" }, 401);
    }

    if (request.method === "POST" && url.pathname === "/upload/presign") {
      const body = (await request.json()) as {
        bucket?: string;
        key?: string;
        contentType?: string;
      };
      if (!body.bucket || !body.key) {
        return json({ error: "bucket and key required" }, 400);
      }
      const r2 = bucketForName(env, body.bucket);
      if (!r2) return json({ error: "Unknown bucket" }, 400);

      // ponytail: Worker returns upload path; client PUTs to /upload/put with same auth
      return json({
        method: "PUT",
        uploadUrl: `${url.origin}/upload/put?bucket=${encodeURIComponent(body.bucket)}&key=${encodeURIComponent(body.key)}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    }

    if (request.method === "PUT" && url.pathname === "/upload/put") {
      const bucketName = url.searchParams.get("bucket") ?? "";
      const key = url.searchParams.get("key") ?? "";
      const r2 = bucketForName(env, bucketName);
      if (!r2 || !key) return json({ error: "Invalid upload target" }, 400);

      await r2.put(key, request.body ?? "", {
        httpMetadata: {
          contentType:
            request.headers.get("content-type") ?? "application/octet-stream",
        },
      });
      return json({ ok: true, key });
    }

    if (request.method === "GET" && url.pathname.startsWith("/download/")) {
      const key = decodeURIComponent(url.pathname.slice("/download/".length));
      const bucketName = url.searchParams.get("bucket") ?? "documents";
      const r2 = bucketForName(env, bucketName);
      if (!r2 || !key) return json({ error: "Not found" }, 404);

      const cache = caches.default;
      const cacheKey = new Request(request.url, request);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const object = await r2.get(key);
      if (!object) return json({ error: "Not found" }, 404);

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      // Cloudflare edge cache — long TTL for immutable user object keys.
      headers.set(
        "cache-control",
        "public, max-age=31536000, immutable, stale-while-revalidate=86400",
      );
      headers.set("cdn-cache-control", "max-age=31536000");
      headers.set("access-control-allow-origin", "*");

      const response = new Response(object.body, { headers });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    if (request.method === "DELETE" && url.pathname === "/object") {
      const body = (await request.json()) as { bucket?: string; key?: string };
      const r2 = body.bucket ? bucketForName(env, body.bucket) : null;
      if (!r2 || !body.key) return json({ error: "bucket and key required" }, 400);
      await r2.delete(body.key);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },
};
