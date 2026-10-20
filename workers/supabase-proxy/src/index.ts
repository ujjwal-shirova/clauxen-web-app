const UPSTREAM = "https://ntplcfsbcyhiqklkbldk.supabase.co";
const HOST = "auth.clauxen.com";
const SERVICES = /^\/(auth|rest|storage|realtime|functions|graphql)\/v1(?:\/|$)/;

export interface Env {
  AUTH_RATE_LIMIT: { limit(input: { key: string }): Promise<{ success: boolean }> };
  BROKER_PROVIDERS?: string;
  OAUTH_BROKER?: Fetcher;
}

function error(status: number, message: string) {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store", "X-Clauxen-Proxy": "1", "Access-Control-Allow-Origin": "*" } });
}

/** Fixed-origin transport. Supabase still verifies API keys, JWTs, RLS and OAuth state. */
export async function handleProxy(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  if (url.hostname !== HOST) return error(404, "Not found.");
  if (url.protocol !== "https:") {
    url.protocol = "https:";
    return Response.redirect(url.href, 308);
  }
  if (url.pathname === "/health" && request.method === "GET")
    return Response.json({ ok: true, service: "clauxen-supabase-proxy" }, { headers: { "Cache-Control": "no-store", "X-Clauxen-Proxy": "1" } });
  if (!SERVICES.test(url.pathname) || /^\/auth\/v1\/admin(?:\/|$)/.test(url.pathname))
    return error(404, "Not found.");
  if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(request.method))
    return error(405, "Method not allowed.");
  try {
    if (url.pathname.startsWith("/auth/v1/") && request.method !== "OPTIONS") {
      const { success } = await env.AUTH_RATE_LIMIT.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
      if (!success) {
        const response = error(429, "Too many authentication requests. Try again shortly.");
        response.headers.set("Retry-After", "60");
        return response;
      }
    }
    const target = new URL(UPSTREAM);
    target.pathname = url.pathname;
    target.search = url.search;
    const provider = target.searchParams.get("provider");
    if (target.pathname === "/auth/v1/authorize" && (provider === "github" || provider === "gitlab") && env.BROKER_PROVIDERS?.split(",").includes(provider))
      target.searchParams.set("provider", `custom:clauxen-${provider}`);
    const headers = new Headers(request.headers);
    // Never let callers select a host, spoof trusted forwarding headers or pass app cookies.
    for (const name of [...headers.keys()]) {
      if (/^(host|cookie|forwarded|x-forwarded-.*|x-real-ip|sb-forwarded-for|cf-.*)$/i.test(name)) headers.delete(name);
    }
    const response = await fetcher(target, {
      method: request.method, headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual", cf: { cacheTtl: 0, cacheEverything: false },
    });
    // Return the upstream WebSocket directly so Cloudflare preserves its upgrade.
    if (response.status === 101) return response;
    const outgoing = new Headers(response.headers);
    outgoing.set("Cache-Control", "no-store, private");
    outgoing.set("Pragma", "no-cache");
    outgoing.set("X-Clauxen-Proxy", "1");
    // Preserve OAuth redirect_uri and state exactly. Rewriting only the authorization
    // redirect would disagree with Supabase's server-side provider token exchange.
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outgoing });
  } catch {
    return error(502, "The backend is temporarily unavailable.");
  }
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.origin === "https://auth.clauxen.com" && env.OAUTH_BROKER &&
      (url.pathname.startsWith("/oauth/") || (url.pathname === "/auth/v1/callback" && url.searchParams.get("state")?.startsWith("clx."))))
      return env.OAUTH_BROKER.fetch(request);
    return handleProxy(request, env);
  },
} satisfies ExportedHandler<Env>;
