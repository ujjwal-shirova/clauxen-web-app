export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  IMAGES: R2Bucket;
  DOCUMENTS: R2Bucket;
  ARTIFACTS: R2Bucket;
  USER_FILES: R2Bucket;
  ATTACHMENTS: R2Bucket;
}

function bucketForName(env: Env, name: string): R2Bucket | null {
  const map: Record<string, R2Bucket> = {
    images: env.IMAGES,
    documents: env.DOCUMENTS,
    artifacts: env.ARTIFACTS,
    "user-files": env.USER_FILES,
    attachments: env.ATTACHMENTS,
    "clauxen-images": env.IMAGES,
    "clauxen-documents": env.DOCUMENTS,
    "clauxen-artifacts": env.ARTIFACTS,
    "clauxen-user-attachments": env.ATTACHMENTS,
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

/**
 * Object keys must be scoped to the authenticated user.
 * Canonical app prefixes: users/{userId}/… and avatars/{userId}/…
 */
function assertKeyOwnedByUser(key: string, userId: string): boolean {
  if (!key || key.includes("..") || key.startsWith("/")) return false;
  const userPrefix = `users/${userId}/`;
  const avatarPrefix = `avatars/${userId}/`;
  return key.startsWith(userPrefix) || key.startsWith(avatarPrefix);
}

/** Unauthenticated public reads: marketing/public assets and profile photos. */
function isPublicObjectKey(key: string): boolean {
  if (!key || key.includes("..") || key.startsWith("/")) return false;
  if (key.startsWith("public/")) return true;
  return /^avatars\/[0-9a-f-]{36}\//i.test(key);
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
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,PUT,POST,DELETE,OPTIONS",
          "access-control-allow-headers": "authorization,content-type",
          "access-control-max-age": "86400",
        },
      });
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    const isDownload = request.method === "GET" && url.pathname.startsWith("/download/");
    const downloadKey = isDownload
      ? decodeURIComponent(url.pathname.slice("/download/".length))
      : "";

    // Public objects under public/ and profile photos under avatars/{userId}/
    // may be read without a JWT so <img> tags can load them.
    const allowAnonymousPublicRead =
      isDownload && isPublicObjectKey(downloadKey);

    const user = await verifySupabaseJwt(request, env);
    if (!user && !allowAnonymousPublicRead) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (request.method === "POST" && url.pathname === "/upload/presign") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const body = (await request.json()) as {
        bucket?: string;
        key?: string;
        contentType?: string;
      };
      if (!body.bucket || !body.key) {
        return json({ error: "bucket and key required" }, 400);
      }
      if (!assertKeyOwnedByUser(body.key, user.sub)) {
        return json({ error: "Forbidden key" }, 403);
      }
      const r2 = bucketForName(env, body.bucket);
      if (!r2) return json({ error: "Unknown bucket" }, 400);

      return json({
        method: "PUT",
        uploadUrl: `${url.origin}/upload/put?bucket=${encodeURIComponent(body.bucket)}&key=${encodeURIComponent(body.key)}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    }

    if (request.method === "PUT" && url.pathname === "/upload/put") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const bucketName = url.searchParams.get("bucket") ?? "";
      const key = url.searchParams.get("key") ?? "";
      const r2 = bucketForName(env, bucketName);
      if (!r2 || !key) return json({ error: "Invalid upload target" }, 400);
      if (!assertKeyOwnedByUser(key, user.sub)) {
        return json({ error: "Forbidden key" }, 403);
      }

      // Browser File/Blob uploads are capped by the app at 100 MB. Buffering
      // preserves a deterministic length for R2 and avoids unknown-length
      // stream truncation while keeping the object private and attributable.
      const body = await request.arrayBuffer();
      await r2.put(key, body, {
        httpMetadata: {
          contentType:
            request.headers.get("content-type") ?? "application/octet-stream",
        },
        customMetadata: {
          userId: user.sub,
          uploadedAt: new Date().toISOString(),
        },
      });
      return new Response(JSON.stringify({ ok: true, key, size: body.byteLength }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "cache-control": "private, no-store",
        },
      });
    }

    if (isDownload) {
      const key = downloadKey;
      const bucketName = url.searchParams.get("bucket") ?? "documents";
      const r2 = bucketForName(env, bucketName);
      if (!r2 || !key) return json({ error: "Not found" }, 404);

      if (allowAnonymousPublicRead) {
        // public/ only — no user JWT required
      } else if (!user || !assertKeyOwnedByUser(key, user.sub)) {
        return json({ error: "Not found" }, 404);
      }

      const object = await r2.get(key);
      if (!object) return json({ error: "Not found" }, 404);

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      // Private user objects must never enter a shared public edge cache.
      headers.set(
        "cache-control",
        allowAnonymousPublicRead
          ? "public, max-age=86400"
          : "private, no-store",
      );
      headers.set("access-control-allow-origin", "*");
      headers.set("vary", "authorization");

      return new Response(object.body, { headers });
    }

    if (request.method === "DELETE" && url.pathname === "/object") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const body = (await request.json()) as { bucket?: string; key?: string };
      const r2 = body.bucket ? bucketForName(env, body.bucket) : null;
      if (!r2 || !body.key) return json({ error: "bucket and key required" }, 400);
      if (!assertKeyOwnedByUser(body.key, user.sub)) {
        return json({ error: "Forbidden key" }, 403);
      }
      await r2.delete(body.key);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },
};
