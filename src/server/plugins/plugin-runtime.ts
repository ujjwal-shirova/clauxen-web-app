import { env } from "@/server/config/env";
import { unsealSecret } from "@/server/plugins/token-crypto";
import {
  callMcpTool,
  listMcpTools,
  mcpResultToText,
  type McpCallResult,
  type McpToolDefinition,
} from "@/server/plugins/mcp-client";
import * as repo from "@/server/repositories/plugin-connections.repository";
import type { PluginConnectionRow } from "@/server/repositories/plugin-connections.repository";

/**
 * Connected-plugin runtime for the chat agent.
 *
 * Turns each connected plugin into agent-visible tools named
 * `mcp__<pluginSlug>__<toolName>` and executes them against the plugin's MCP
 * server with the user's stored OAuth access token. Expired tokens are rotated
 * through the plugin-oauth Cloudflare worker before the call.
 */

export type AgentMcpTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ResolvedMcpTarget = {
  connection: PluginConnectionRow;
  toolName: string;
  args: Record<string, unknown>;
};

/** Cache of discovered tools per connection to avoid a tools/list per turn. */
type ToolCacheEntry = {
  expiresAt: number;
  tools: McpToolDefinition[];
};
const toolCache = new Map<string, ToolCacheEntry>();
const TOOL_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** `mcp__<slug>__<tool>` — the shape the trace UI already renders. */
export function mcpToolName(pluginSlug: string, toolName: string): string {
  return `mcp__${pluginSlug}__${toolName}`;
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return false;
  // Refresh a minute early so a mid-turn expiry never surfaces to the model.
  return at - 60_000 < Date.now();
}

// ─── token access ───────────────────────────────────────────────────────────

type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "not_configured" | "reauthorization_required" | "unavailable" };

async function requestWorkerRefresh(connectionId: string): Promise<boolean> {
  const base = env.pluginOAuthWorkerUrl;
  const token = env.pluginOAuthInternalToken;
  if (!base || !token) return false;

  try {
    const response = await fetch(`${base}/v0/oauth/refresh`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-clauxen-internal-token": token,
      },
      body: JSON.stringify({ connectionId }),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return true;
    // 409 means the refresh token itself is gone — the user must reconnect.
    if (response.status === 409) return false;
    return false;
  } catch {
    return false;
  }
}

/**
 * Return a usable access token for a connection, rotating it through the
 * OAuth worker when the stored one has expired.
 */
export async function getAccessToken(
  connection: PluginConnectionRow,
): Promise<AccessTokenResult> {
  const sealed = await repo.readSealedTokens(connection.id);
  if (!sealed) {
    return { ok: false, reason: "reauthorization_required" };
  }

  const accessToken = await unsealSecret(sealed.access_token_sealed);
  if (!accessToken) {
    return { ok: false, reason: "reauthorization_required" };
  }

  if (!isExpired(sealed.expires_at)) {
    return { ok: true, accessToken };
  }

  if (!sealed.refresh_token_sealed) {
    await repo.setConnectionStatus(connection.id, "reauthorization_required");
    return { ok: false, reason: "reauthorization_required" };
  }

  const refreshed = await requestWorkerRefresh(connection.id);
  if (!refreshed) {
    await repo.setConnectionStatus(connection.id, "reauthorization_required");
    return { ok: false, reason: "reauthorization_required" };
  }

  const rotated = await repo.readSealedTokens(connection.id);
  const next = rotated ? await unsealSecret(rotated.access_token_sealed) : null;
  if (!next) return { ok: false, reason: "unavailable" };
  return { ok: true, accessToken: next };
}

// ─── tool discovery ─────────────────────────────────────────────────────────

async function toolsForConnection(
  connection: PluginConnectionRow,
): Promise<McpToolDefinition[]> {
  const cached = toolCache.get(connection.id);
  if (cached && cached.expiresAt > Date.now()) return cached.tools;

  const token = await getAccessToken(connection);
  if (!token.ok) return [];

  const listed = await listMcpTools(connection.mcp_url, token.accessToken);
  if (!listed.ok) return [];

  toolCache.set(connection.id, {
    expiresAt: Date.now() + TOOL_CACHE_TTL_MS,
    tools: listed.value,
  });

  // Keep a durable copy so the plugin page can show what is connected.
  await repo
    .replaceConnectionTools(
      connection.id,
      listed.value.map((tool) => ({
        name: tool.name,
        title: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    )
    .catch(() => null);

  await repo.touchConnectionUsage(connection.id).catch(() => null);
  return listed.value;
}

/**
 * Build the MCP tool definitions the agent loop should append to its tool
 * list for this user. Empty when the user has no connected plugins.
 */
export async function buildAgentMcpTools(
  userId: string,
): Promise<AgentMcpTool[]> {
  const connections = await repo.listActiveConnectionsForUser(userId);
  if (connections.length === 0) return [];

  const tools: AgentMcpTool[] = [];
  for (const connection of connections) {
    const slug = normalizeSlug(connection.plugin_id) || "plugin";
    for (const tool of await toolsForConnection(connection)) {
      // Tool names must match the model's naming constraints.
      const safeTool = tool.name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60);
      tools.push({
        type: "function",
        name: mcpToolName(slug, safeTool),
        description: [
          `Use the connected "${connection.plugin_name || connection.plugin_id}" plugin`,
          tool.description ? `— ${tool.description}` : "",
          `to perform this action through its ${tool.name} tool.`,
          "The user has already authorized this plugin, so no extra sign-in is needed.",
        ]
          .filter(Boolean)
          .join(" "),
        parameters: tool.inputSchema ?? {
          type: "object",
          properties: {},
        },
      });
    }
  }
  return tools;
}

/** Resolve a `mcp__<slug>__<tool>` name back to a connection + raw tool name. */
export async function resolveMcpToolCall(
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ResolvedMcpTarget | null> {
  const parts = toolName.split("__");
  if (parts.length < 3 || parts[0] !== "mcp") return null;

  const slug = parts[1] ?? "";
  const rawTool = parts.slice(2).join("__");
  if (!slug || !rawTool) return null;

  const connections = await repo.listActiveConnectionsForUser(userId);
  const connection = connections.find(
    (candidate) => normalizeSlug(candidate.plugin_id) === slug,
  );
  if (!connection) return null;

  return { connection, toolName: rawTool, args };
}

// ─── execution ──────────────────────────────────────────────────────────────

export type McpExecutionOutcome = {
  output: string;
  isError: boolean;
  pluginName: string;
};

/** Run one connected-plugin tool call. Never throws. */
export async function executeMcpToolCall(
  target: ResolvedMcpTarget,
): Promise<McpExecutionOutcome> {
  const { connection, toolName, args } = target;
  const pluginName = connection.plugin_name || connection.plugin_id;

  const token = await getAccessToken(connection);
  if (!token.ok) {
    await repo.setConnectionStatus(connection.id, "reauthorization_required");
    return {
      output: `The "${pluginName}" plugin is no longer authorized. Ask the user to reconnect it from the Plugins page.`,
      isError: true,
      pluginName,
    };
  }

  const result = await callMcpTool(connection.mcp_url, token.accessToken, toolName, args);
  if (!result.ok) {
    if (result.code === "unauthorized" || result.code === "forbidden") {
      // One retry after an out-of-band refresh.
      const refreshed = await requestWorkerRefresh(connection.id);
      if (refreshed) {
        const retryToken = await getAccessToken(connection);
        if (retryToken.ok) {
          const retry = await callMcpTool(
            connection.mcp_url,
            retryToken.accessToken,
            toolName,
            args,
          );
          if (retry.ok) return toOutcome(pluginName, retry.value);
          return {
            output: retry.message,
            isError: true,
            pluginName,
          };
        }
      }
      await repo.setConnectionStatus(connection.id, "reauthorization_required");
      return {
        output: `The "${pluginName}" plugin needs to be reconnected before it can be used.`,
        isError: true,
        pluginName,
      };
    }
    return { output: result.message, isError: true, pluginName };
  }

  await repo.touchConnectionUsage(connection.id).catch(() => null);
  return toOutcome(pluginName, result.value);
}

function toOutcome(pluginName: string, result: McpCallResult): McpExecutionOutcome {
  return {
    output: mcpResultToText(result),
    isError: result.isError,
    pluginName,
  };
}
