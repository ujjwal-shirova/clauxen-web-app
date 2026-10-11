import type { Request as WorkerRequest } from "@cloudflare/workers-types";
import { SignJWT, jwtVerify } from "jose";
import { cloudflareContext } from "./context";

export function nativeBucket(
  env: CloudflareEnv,
  name: string,
): R2Bucket | null {
  const buckets: Record<string, R2Bucket> = {
    "clauxen-images": env.R2_IMAGES,
    "clauxen-documents": env.R2_DOCUMENTS,
    "clauxen-artifacts": env.R2_ARTIFACTS,
    "clauxen-skills": env.R2_SKILLS,
    "clauxen-chat-archives": env.R2_CHAT_ARCHIVES,
    "clauxen-user-attachments": env.R2_ATTACHMENTS,
  };
  return buckets[name] ?? null;
}

export function requestBucket(name: string): R2Bucket | null {
  const context = cloudflareContext();
  return context ? nativeBucket(context.env, name) : null;
}

export async function signedObjectUrl(input: {
  bucket: string;
  key: string;
  method: "GET" | "PUT";
  contentType?: string;
  expiresIn: number;
}): Promise<string> {
  const env = cloudflareContext()?.env;
  if (!env?.R2_SIGNING_KEY) throw new Error("R2 URL signing key is missing");
  if (!nativeBucket(env, input.bucket)) throw new Error("Unknown R2 bucket");
  const token = await new SignJWT({
    bucket: input.bucket,
    key: input.key,
    method: input.method,
    contentType: input.contentType,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("clauxen-storage")
    .setAudience("clauxen-object")
    .setIssuedAt()
    .setExpirationTime(
      Math.floor(Date.now() / 1000) +
        Math.min(3600, Math.max(1, input.expiresIn)),
    )
    .sign(new TextEncoder().encode(env.R2_SIGNING_KEY));
  // Use the Worker origin during staging as well as after domain cutover.
  const origin = new URL(env.GENERATIONS_EXECUTION_ORIGIN).origin;
  return `${origin}/api/v1/storage/object?token=${encodeURIComponent(token)}`;
}

/** Stream private objects directly through R2 bindings, outside Next rendering. */
export async function handleSignedObject(
  request: Request | WorkerRequest,
  env: CloudflareEnv,
): Promise<Response> {
  const origin = request.headers.get("origin");
  const allowed = [env.NEXT_PUBLIC_APP_URL, env.GENERATIONS_EXECUTION_ORIGIN]
    .filter(Boolean)
    .map((url) => new URL(url).origin);
  if (env.NEXT_PUBLIC_APP_URL)
    allowed.push(
      new URL(env.NEXT_PUBLIC_APP_URL).origin.replace("://www.", "://"),
    );
  const cors: Record<string, string> =
    origin && allowed.includes(origin)
      ? { "access-control-allow-origin": origin, vary: "Origin" }
      : {};
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: origin && allowed.includes(origin) ? 204 : 403,
      headers: {
        ...cors,
        "access-control-allow-methods": "GET, PUT, HEAD",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "600",
      },
    });
  }
  const response = await serveSignedObject(request, env);
  for (const [key, value] of Object.entries(cors))
    response.headers.set(key, value);
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}

async function serveSignedObject(
  request: Request | WorkerRequest,
  env: CloudflareEnv,
): Promise<Response> {
  if (!["GET", "PUT", "HEAD"].includes(request.method))
    return new Response("Method not allowed", { status: 405 });
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token || !env.R2_SIGNING_KEY)
      return new Response("Unauthorized", { status: 401 });
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.R2_SIGNING_KEY),
      {
        algorithms: ["HS256"],
        issuer: "clauxen-storage",
        audience: "clauxen-object",
      },
    );
    const { bucket, key, method, contentType } = payload;
    if (
      typeof bucket !== "string" ||
      typeof key !== "string" ||
      !key ||
      key.startsWith("/") ||
      key.split("/").includes("..") ||
      (request.method === "HEAD" ? method !== "GET" : method !== request.method)
    )
      return new Response("Forbidden", { status: 403 });
    const storage = nativeBucket(env, bucket);
    if (!storage) return new Response("Forbidden", { status: 403 });
    if (request.method === "PUT") {
      const length = Number(request.headers.get("content-length"));
      if (!Number.isFinite(length) || length <= 0 || length > 100 * 1024 * 1024)
        return new Response("Upload requires a content length of 1–100 MiB", {
          status: 413,
        });
      await storage.put(key, request.body as Parameters<R2Bucket["put"]>[1], {
        httpMetadata: {
          contentType:
            typeof contentType === "string"
              ? contentType
              : "application/octet-stream",
        },
      });
      return new Response(null, {
        status: 204,
        headers: { "cache-control": "no-store" },
      });
    }
    const object = await storage.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
    headers.set(
      "content-type",
      object.httpMetadata?.contentType || "application/octet-stream",
    );
    if (object.httpMetadata?.contentDisposition)
      headers.set(
        "content-disposition",
        object.httpMetadata.contentDisposition,
      );
    headers.set("etag", object.httpEtag);
    headers.set("content-length", String(object.size));
    // User-uploaded HTML must never execute on the application's origin.
    if (/html|svg|javascript|xml/i.test(headers.get("content-type") || "")) {
      headers.set("content-disposition", "attachment");
      headers.set("content-security-policy", "sandbox");
    }
    if (request.method === "HEAD") return new Response(null, { headers });
    const reader = object.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const chunk = await reader.read();
        if (chunk.done) controller.close();
        else controller.enqueue(chunk.value);
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
    return new Response(body, { headers });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
