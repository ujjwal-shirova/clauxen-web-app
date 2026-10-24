export interface Env {
  CDN_BUCKET: R2Bucket;
}

let bundleCache: Map<string, Uint8Array> | null = null;

function parseTar(buffer: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  const decoder = new TextDecoder("utf-8");

  while (offset < buffer.length - 512) {
    const header = buffer.subarray(offset, offset + 512);
    let isAllZero = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) {
        isAllZero = false;
        break;
      }
    }
    if (isAllZero) break;

    let nameEnd = 0;
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
    const name = decoder.decode(header.subarray(0, nameEnd)).trim();

    let sizeEnd = 124;
    while (sizeEnd < 136 && header[sizeEnd] !== 0) sizeEnd++;
    const sizeStr = decoder.decode(header.subarray(124, sizeEnd)).trim();
    const size = parseInt(sizeStr, 8) || 0;

    offset += 512;
    if (name && size > 0 && offset + size <= buffer.length) {
      files.set(name.toLowerCase(), buffer.subarray(offset, offset + size));
    }
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, status: "healthy", domain: "cdn.clauxen.com" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const cache = caches.default;
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    let filename = "";
    const cleanPath = url.pathname.toLowerCase();
    const match = cleanPath.match(/(?:plugins\/icons\/|plugins\/|icons\/)?([a-z0-9_-]+)\.(png|jpg|jpeg|svg|webp)$/i);
    if (match) {
      filename = `${match[1]}.${match[2]}`.toLowerCase();
    } else if (cleanPath === "/plugin-icons-bundle.tar") {
      const obj = await env.CDN_BUCKET.get("plugin-icons-bundle.tar");
      if (!obj) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set("Cache-Control", "public, max-age=86400");
      return new Response(obj.body, { headers });
    }

    if (!filename) {
      return new Response("Not found", { status: 404 });
    }

    if (!bundleCache) {
      const obj = await env.CDN_BUCKET.get("plugin-icons-bundle.tar");
      if (!obj) {
        return new Response("CDN asset bundle not found", { status: 404 });
      }
      const data = new Uint8Array(await obj.arrayBuffer());
      bundleCache = parseTar(data);
    }

    const fileBytes = bundleCache.get(filename);
    if (!fileBytes) {
      return new Response(`Icon ${filename} not found in bundle`, { status: 404 });
    }

    const contentType = filename.endsWith(".svg") ? "image/svg+xml" : "image/png";
    const response = new Response(fileBytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "ETag": `"${filename}-${fileBytes.length}"`,
        "X-CDN-Provider": "Cloudflare R2 (Clauxen)",
      },
    });

    ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};
