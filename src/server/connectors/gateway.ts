import "server-only";

import { AppError } from "@/server/db/errors";
import { env } from "@/server/config/env";

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
  const timeout = setTimeout(() => controller.abort(), 30_000);
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
  return gatewayRequest<{ connections: unknown[] }>("/v1/connections", userId, {
    method: "GET",
  });
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
  return gatewayRequest<{ approvalId: string; status: string }>(
    `/v1/approvals/${encodeURIComponent(approvalId)}/${decision}`,
    userId,
    { method: "POST", body: "{}" },
  );
}
