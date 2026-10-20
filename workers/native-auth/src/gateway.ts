const PREFIX = "/api/v1/auth/native/";
const CALLBACK = "com.clauxen.mobile://auth-callback";
const BODY_LIMIT = 64 * 1024;
const RESPONSE_LIMIT = 128 * 1024;

class GatewayError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function fail(status: number, code: string, message: string): never {
  throw new GatewayError(status, code, message);
}

function responseHeaders() {
  return new Headers({
    "Cache-Control": "no-store, private",
    "Pragma": "no-cache",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Clauxen-Auth-Gateway": "1",
  });
}

/** Limit chunked bodies as well as requests with a Content-Length header. */
async function boundedText(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        fail(413, "body_too_large", "Authentication payload is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

function validateRequest(url: URL, request: Request, body: Record<string, unknown> | null): string {
  if (!url.pathname.startsWith(PREFIX)) fail(404, "not_found", "Not found.");
  const endpoint = url.pathname.slice(PREFIX.length);
  const methods: Record<string, string[]> = {
    token: ["POST"], authorize: ["GET"], otp: ["POST"], verify: ["POST"],
    recover: ["POST"], logout: ["POST"], user: ["GET", "PUT"],
  };
  if (!Object.hasOwn(methods, endpoint)) fail(404, "not_found", "Not found.");
  if (!methods[endpoint].includes(request.method)) fail(405, "method_not_allowed", "Method not allowed.");
  // No caller-selected upstream, administrative Auth endpoints, or ambiguous queries.
  for (const key of new Set(url.searchParams.keys())) {
    if (url.searchParams.getAll(key).length !== 1) fail(400, "invalid_query", "Duplicate query parameters are not allowed.");
  }
  const redirect = url.searchParams.get("redirect_to");
  if (redirect && redirect !== CALLBACK) fail(400, "invalid_redirect", "Invalid authentication callback.");
  if (body?.redirect_to !== undefined && body.redirect_to !== CALLBACK)
    fail(400, "invalid_redirect", "Invalid authentication callback.");
  if (endpoint === "authorize") {
    if (!["google", "github", "gitlab"].includes(url.searchParams.get("provider") ?? ""))
      fail(400, "invalid_provider", "Unsupported OAuth provider.");
    if (redirect !== CALLBACK || url.searchParams.get("code_challenge_method")?.toLowerCase() !== "s256" ||
        !/^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("code_challenge") ?? ""))
      fail(400, "invalid_pkce", "A native callback and PKCE challenge are required.");
  }
  if (endpoint === "token") {
    const grant = url.searchParams.get("grant_type");
    if (!["id_token", "password", "refresh_token", "pkce"].includes(grant ?? ""))
      fail(400, "unsupported_grant_type", "Unsupported authentication grant.");
    if (grant === "id_token" && (body?.provider !== "google" ||
        typeof body.id_token !== "string" || !body.id_token ||
        typeof body.nonce !== "string" || body.nonce.length < 32 || body.nonce.length > 256))
      fail(400, "invalid_credentials", "A Google ID token and nonce are required.");
  }
  if (["user", "logout"].includes(endpoint) && !request.headers.get("Authorization")?.startsWith("Bearer "))
    fail(401, "no_authorization", "Authentication required.");
  return endpoint;
}

/** Public Auth gateway; Supabase remains the token issuer and validates every credential. */
export async function handleNativeAuth(request: Request, env: NativeAuthEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === `${PREFIX}health`)
      return Response.json({ ok: true, service: "clauxen-native-auth" }, { headers: responseHeaders() });
    const origin = request.headers.get("Origin");
    if (origin && !["https://www.clauxen.com", "https://clauxen.com"].includes(origin))
      fail(403, "origin_not_allowed", "Request origin is not allowed.");
    const raw = await boundedText(request.body, BODY_LIMIT);
    let body: Record<string, unknown> | null = null;
    if (raw) {
      if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
        fail(415, "invalid_content_type", "JSON is required.");
      try { body = JSON.parse(raw); } catch { fail(400, "bad_json", "Invalid JSON."); }
      if (!body || Array.isArray(body) || typeof body !== "object") fail(400, "bad_json", "A JSON object is required.");
    }
    const endpoint = validateRequest(url, request, body);
    // Coarse per-IP abuse protection, layered with Supabase's own account/OTP limits.
    // No account identity is trusted before Supabase verifies the credential.
    const key = `native-auth:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`;
    const { success } = await env.AUTH_RATE_LIMIT.limit({ key });
    if (!success) fail(429, "over_request_rate_limit", "Too many sign-in requests. Try again shortly.");
    if (endpoint === "authorize" && ["github", "gitlab"].includes(url.searchParams.get("provider") ?? "")) {
      const authorize = new URL("https://auth.clauxen.com/auth/v1/authorize");
      authorize.search = url.search;
      const headers = responseHeaders();
      headers.set("Location", authorize.href);
      return new Response(null, { status: 302, headers });
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
      fail(503, "auth_unavailable", "Authentication is temporarily unavailable.");
    const base = new URL(env.SUPABASE_URL);
    if (base.protocol !== "https:" || base.pathname !== "/" || base.username || base.password || base.search || base.hash)
      fail(503, "auth_unavailable", "Authentication is temporarily unavailable.");
    const upstream = new URL(`/auth/v1/${endpoint}`, base);
    upstream.search = url.search;
    const headers = new Headers({
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      "X-Client-Info": "clauxen-native-auth/1",
    });
    const apiVersion = request.headers.get("X-Supabase-Api-Version");
    if (apiVersion && /^\d{4}-\d{2}-\d{2}$/.test(apiVersion)) headers.set("X-Supabase-Api-Version", apiVersion);
    const authorization = request.headers.get("Authorization");
    if (authorization?.startsWith("Bearer ") && authorization.slice(7) !== env.SUPABASE_PUBLISHABLE_KEY)
      headers.set("Authorization", authorization);
    const upstreamResponse = await fetcher(upstream, {
      method: request.method, headers, body: raw || undefined,
      redirect: "manual", signal: AbortSignal.timeout(20_000),
    });
    const outgoing = responseHeaders();
    const retryAfter = upstreamResponse.headers.get("Retry-After");
    if (retryAfter) outgoing.set("Retry-After", retryAfter);
    const location = upstreamResponse.headers.get("Location");
    if (location && endpoint === "authorize") outgoing.set("Location", location);
    if ([204, 304].includes(upstreamResponse.status))
      return new Response(null, { status: upstreamResponse.status, headers: outgoing });
    // Preserve GoTrue's wire format for the native SDK, but never forward cookies or cache headers.
    const text = await boundedText(upstreamResponse.body, RESPONSE_LIMIT);
    if (text && !location) {
      try { JSON.parse(text); } catch { fail(502, "upstream_unavailable", "The authentication service is temporarily unavailable."); }
    }
    return new Response(text || null, { status: upstreamResponse.status, headers: outgoing });
  } catch (error) {
    const known = error instanceof GatewayError;
    const status = known ? error.status : 502;
    const headers = responseHeaders();
    if (status === 429) headers.set("Retry-After", "60");
    // Never expose exception text, credentials, refresh tokens, or upstream configuration.
    return Response.json({
      error_code: known ? error.code : "upstream_unavailable",
      msg: known ? error.message : "The authentication service is temporarily unavailable.",
    }, { status, headers });
  }
}

