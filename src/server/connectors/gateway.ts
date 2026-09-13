import "server-only";

import { AppError } from "@/server/db/errors";
import { env } from "@/server/config/env";
import {
  decideLocalApproval,
  disconnectLocal,
  listLocalConnections,
} from "@/server/connectors/local";

type GatewayEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string };
};

export type ConnectorGatewayTool = {
  qualifiedName: string;
  connectorKey: string;
  connectorName: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ConnectorConnection = {
  id: string;
  connectorKey: string;
  connectorName: string;
  provider: string;
  protocol?: string;
  pluginId?: string | null;
  mcpUrl?: string | null;
  logoUrl?: string | null;
  status: string;
  accountLabel?: string | null;
  grantedScopes?: string[];
  connectedAt?: string | null;
  lastUsedAt?: string | null;
  lastErrorCode?: string | null;
  toolCount?: number;
  skills?: unknown;
};

export type McpInstallResult = {
  status: "connected" | "authorization_required";
  connectorKey: string;
  installationId: string | null;
  authorizeUrl: string | null;
  toolCount?: number;
  skillCount?: number;
  expiresIn?: number;
};

export type ConnectorGatewayCallResult = {
  text: string;
  isError: boolean;
  status?: number;
  requiresApproval?: boolean;
  approvalId?: string;
  expiresAt?: string;
  action?: {
    connector?: string;
    tool?: string;
    risk?: string;
  };
};

export function connectorGatewayConfigured(): boolean {
  return Boolean(env.connectorGatewayUrl && env.connectorGatewayInternalToken);
}

async function gatewayRequest<T>(
  path: string,
  userId: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<T> {
  if (!connectorGatewayConfigured()) {
    throw new AppError(
      "Connector service is not configured.",
      503,
      "connector_service_unavailable",
    );
  }

  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("x-clauxen-internal", env.connectorGatewayInternalToken);
  headers.set("x-clauxen-user-id", userId);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${env.connectorGatewayUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    throw new AppError(
      error instanceof Error && error.name === "AbortError"
        ? "Connector service timed out."
        : "Connector service is unavailable.",
      503,
      "connector_service_unavailable",
    );
  } finally {
    clearTimeout(timeout);
  }

  let payload: GatewayEnvelope<T> = {};
  try {
    payload = (await response.json()) as GatewayEnvelope<T>;
  } catch {
    throw new AppError(
      "Connector service returned an invalid response.",
      502,
      "connector_gateway_invalid_response",
    );
  }
  if (!response.ok || !payload.data) {
    throw new AppError(
      payload.error?.message || "Connector request failed.",
      response.status >= 400 ? response.status : 502,
      payload.error?.code || "connector_request_failed",
    );
  }
  return payload.data;
}

export function listConnectorConnections(userId: string) {
  if (!connectorGatewayConfigured()) {
    return listLocalConnections(userId);
  }
  return gatewayRequest<{ connections: ConnectorConnection[] }>(
    "/v1/connections",
    userId,
    { method: "GET" },
  );
}

export function installMcpPlugin(
  userId: string,
  input: {
    pluginId: string;
    displayName: string;
    mcpUrl: string;
    logoUrl?: string | null;
    returnUrl: string;
  },
) {
  return gatewayRequest<McpInstallResult>(
    "/v1/mcp/install",
    userId,
    { method: "POST", body: JSON.stringify(input) },
    45_000,
  );
}

export function startConnectorOAuth(
  userId: string,
  input: {
    connectorKey: string;
    workspaceId?: string | null;
    returnUrl: string;
  },
) {
  return gatewayRequest<{ authorizeUrl: string; expiresIn: number }>(
    "/v1/oauth/start",
    userId,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function disconnectConnector(userId: string, installationId: string) {
  if (!connectorGatewayConfigured()) {
    return disconnectLocal(userId, installationId);
  }
  return gatewayRequest<{ installationId: string; disconnected: boolean }>(
    `/v1/connections/${encodeURIComponent(installationId)}`,
    userId,
    { method: "DELETE" },
  );
}

export async function listConnectorGatewayTools(
  userId: string,
): Promise<ConnectorGatewayTool[]> {
  const result = await gatewayRequest<{ tools: ConnectorGatewayTool[] }>(
    "/v1/tools/list",
    userId,
    { method: "POST", body: "{}" },
  );
  return result.tools;
}

export function callConnectorGatewayTool(
  userId: string,
  input: {
    connectorKey: string;
    toolName: string;
    arguments: Record<string, unknown>;
    approvalId?: string;
  },
) {
  return gatewayRequest<ConnectorGatewayCallResult>("/v1/tools/call", userId, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function decideConnectorApproval(
  userId: string,
  approvalId: string,
  decision: "approve" | "deny",
) {
  if (!connectorGatewayConfigured()) {
    return decideLocalApproval(
      userId,
      approvalId,
      decision === "approve" ? "approved" : "denied",
    );
  }
  return gatewayRequest<{ approvalId: string; status: string }>(
    `/v1/approvals/${encodeURIComponent(approvalId)}/${decision}`,
    userId,
    { method: "POST", body: "{}" },
  );
}
