import { constantTimeEqual } from "./crypto";

const JSON_LIMIT_BYTES = 64 * 1024;

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export function json(
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...Object.fromEntries(new Headers(extraHeaders)),
    },
  });
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > JSON_LIMIT_BYTES) {
    throw new HttpError("Request body is too large.", 413, "body_too_large");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError("Invalid JSON body.", 400, "invalid_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError("JSON object required.", 400, "invalid_body");
  }
  return body as Record<string, unknown>;
}

export function requireInternal(request: Request, env: Env): string {
  const token = request.headers.get("x-clauxen-internal") ?? "";
  if (
    !token ||
    !constantTimeEqual(token, env.CONNECTOR_GATEWAY_INTERNAL_TOKEN)
  ) {
    throw new HttpError("Unauthorized.", 401, "unauthorized");
  }
  const userId = request.headers.get("x-clauxen-user-id") ?? "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    throw new HttpError(
      "A valid user identity is required.",
      401,
      "invalid_user",
    );
  }
  return userId;
}

export function requireAdmin(request: Request, env: Env): void {
  const token = request.headers.get("x-clauxen-admin") ?? "";
  if (!token || !constantTimeEqual(token, env.CONNECTOR_GATEWAY_ADMIN_TOKEN)) {
    throw new HttpError("Unauthorized.", 401, "unauthorized");
  }
}

export function stringField(
  body: Record<string, unknown>,
  key: string,
  options: { required?: boolean; max?: number } = {},
): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    if (options.required) {
      throw new HttpError(`${key} is required.`, 400, "invalid_body");
    }
    return null;
  }
  if (typeof value !== "string") {
    throw new HttpError(`${key} must be a string.`, 400, "invalid_body");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > (options.max ?? 4096)) {
    throw new HttpError(`${key} is invalid.`, 400, "invalid_body");
  }
  return trimmed;
}

export function httpsUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(`${field} must be a valid URL.`, 400, "invalid_url");
  }
  if (parsed.protocol !== "https:") {
    throw new HttpError(`${field} must use HTTPS.`, 400, "invalid_url");
  }
  return parsed.toString();
}

export function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof HttpError) {
    return json(
      { error: { code: error.code, message: error.message }, requestId },
      error.status,
      error.code === "rate_limited" ? { "retry-after": "60" } : undefined,
    );
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "connector_gateway_error",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  return json(
    {
      error: { code: "internal_error", message: "Internal connector error." },
      requestId,
    },
    500,
  );
}

export function allowedReturnUrl(value: string, env: Env): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError("returnUrl must be a valid URL.", 400, "invalid_url");
  }
  const isLocal =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) {
    throw new HttpError("returnUrl must use HTTPS.", 400, "invalid_url");
  }
  const rules = env.APP_ORIGINS.split(",").map((item) => item.trim());
  const allowed = rules.some((rule) => {
    if (!rule) return false;
    if (rule === parsed.origin) return true;
    if (rule.startsWith("https://*.")) {
      const suffix = rule.slice("https://*.".length);
      return (
        parsed.protocol === "https:" &&
        parsed.hostname.endsWith(`.${suffix}`) &&
        parsed.hostname !== suffix
      );
    }
    return false;
  });
  if (!allowed) {
    throw new HttpError(
      "Return URL is not allowed.",
      400,
      "invalid_return_url",
    );
  }
  return parsed.toString();
}
