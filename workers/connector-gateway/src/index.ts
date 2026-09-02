import {
  callTool,
  configureConnectorTools,
  decideApproval,
  disconnect,
  listConnections,
  listTools,
} from "./connectors";
import { withDatabase } from "./db";
import {
  errorResponse,
  HttpError,
  json,
  requireAdmin,
  requireInternal,
} from "./http";
import { installMcpPlugin } from "./mcp-install";
import { configureOAuthConnector, finishOAuth, startOAuth } from "./oauth";
import { consumeConnectorEvents } from "./events";
import { recordMetric } from "./metrics";

function requestId(request: Request): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("cf-ray") ??
    crypto.randomUUID()
  );
}

function uuidPath(value: string, field: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new HttpError(`${field} is invalid.`, 400, "invalid_identifier");
  }
  return value;
}

async function enforceRateLimit(
  limiter: RateLimit,
  key: string,
): Promise<void> {
  const outcome = await limiter.limit({ key });
  if (!outcome.success) {
    throw new HttpError(
      "Too many requests. Try again shortly.",
      429,
      "rate_limited",
    );
  }
}

function metricRoute(path: string): string {
  return path
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      ":id",
    )
    .slice(0, 160);
}

async function route(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && path === "/health") {
    await withDatabase(env, async (sql) => sql`select 1`);
    return json({ status: "ok", service: "clauxen-connector-gateway" });
  }

  const oauthCallback =
    /^\/v1\/oauth\/callback\/([a-z0-9][a-z0-9-]{1,79})$/.exec(path);
  if (request.method === "GET" && oauthCallback) {
    return finishOAuth(request, env, ctx, oauthCallback[1]!);
  }

  const adminOAuth =
    /^\/v1\/admin\/connectors\/([a-z0-9][a-z0-9-]{1,79})\/oauth$/.exec(path);
  if (request.method === "PUT" && adminOAuth) {
    requireAdmin(request, env);
    return configureOAuthConnector(request, env, adminOAuth[1]!);
  }

  const adminTools =
    /^\/v1\/admin\/connectors\/([a-z0-9][a-z0-9-]{1,79})\/tools$/.exec(path);
  if (request.method === "PUT" && adminTools) {
    requireAdmin(request, env);
    return configureConnectorTools(request, env, adminTools[1]!);
  }

  const userId = requireInternal(request, env);

  if (request.method === "POST" && path === "/v1/oauth/start") {
    await enforceRateLimit(env.CONNECTOR_OAUTH_RATE_LIMITER, `oauth:${userId}`);
    return startOAuth(request, env, ctx, userId);
  }
  if (request.method === "POST" && path === "/v1/mcp/install") {
    await enforceRateLimit(env.CONNECTOR_OAUTH_RATE_LIMITER, `oauth:${userId}`);
    return installMcpPlugin(request, env, ctx, userId);
  }
  if (request.method === "POST" && path === "/v1/tools/call") {
    await enforceRateLimit(env.CONNECTOR_TOOL_RATE_LIMITER, `tool:${userId}`);
    return callTool(request, env, ctx, userId);
  }

  await enforceRateLimit(env.CONNECTOR_RATE_LIMITER, `api:${userId}`);
  if (request.method === "GET" && path === "/v1/connections") {
    return listConnections(env, userId);
  }
  if (request.method === "POST" && path === "/v1/tools/list") {
    return listTools(env, userId);
  }
  const connection = /^\/v1\/connections\/([^/]+)$/.exec(path);
  if (request.method === "DELETE" && connection) {
    return disconnect(
      env,
      ctx,
      userId,
      uuidPath(connection[1]!, "installationId"),
    );
  }

  const approval = /^\/v1\/approvals\/([^/]+)\/(approve|deny)$/.exec(path);
  if (request.method === "POST" && approval) {
    return decideApproval(
      env,
      userId,
      uuidPath(approval[1]!, "approvalId"),
      approval[2] === "approve" ? "approved" : "denied",
    );
  }

  throw new HttpError("Route not found.", 404, "not_found");
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const id = requestId(request);
    const started = Date.now();
    let response: Response;
    try {
      response = await route(request, env, ctx);
    } catch (error) {
      response = errorResponse(error, id);
    }

    const url = new URL(request.url);
    recordMetric({
      kind: "http_request",
      route: metricRoute(url.pathname),
      status: String(response.status),
      durationMs: Date.now() - started,
    });

    const headers = new Headers(response.headers);
    headers.set("x-request-id", id);
    headers.set("referrer-policy", "no-referrer");
    headers.set(
      "permissions-policy",
      "camera=(), microphone=(), geolocation=()",
    );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const started = Date.now();
    try {
      await consumeConnectorEvents(batch, env);
      recordMetric({
        kind: "queue_batch",
        status: "succeeded",
        durationMs: Date.now() - started,
        value: batch.messages.length,
      });
    } catch (error) {
      recordMetric({
        kind: "queue_batch",
        status: "failed",
        durationMs: Date.now() - started,
        value: batch.messages.length,
      });
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
