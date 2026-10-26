import {
  callMcpTool,
  mcpResultToText,
} from "@/server/plugins/mcp-client";
import {
  createRestApi,
  findRestTool,
  RestApiError,
  type RestToolsetId,
  type ToolRisk,
} from "@/server/plugins/rest-toolsets";
import {
  checkRateLimit,
  inspectArguments,
  sanitizeUntrustedOutput,
  UNTRUSTED_CONTENT_NOTICE,
} from "@/server/plugins/plugin-firewall";
import { getAccessToken, readPlainTokens } from "@/server/plugins/token-manager";
import { syncCapabilities } from "@/server/plugins/plugin-connect";
import * as repo from "@/server/repositories/plugin-connections.repository";
import type {
  PluginConnectionRow,
  PluginConnectionToolRow,
} from "@/server/repositories/plugin-connections.repository";

/**
 * Connected-plugin runtime for the chat agent.
 *
 * Each enabled tool of an active connection becomes an agent tool named
 * `mcp__<plugin>__<tool>`. Calls run through the firewall: permission mode,
 * argument inspection, rate limits, output sanitization, and an audit trace.
 * The model never receives a token — the runtime injects it at call time.
 */

export type AgentMcpTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ResolvedMcpTarget = {
  connection: PluginConnectionRow;
  tool: PluginConnectionToolRow;
  args: Record<string, unknown>;
};

export type McpExecutionOutcome = {
  output: unknown;
  isError: boolean;
  pluginName: string;
};

/** Tools offered directly; past this the model finds the rest via search. */
const DIRECT_TOOL_LIMIT = 48;
const SEARCH_TOOL = "mcp__plugins__search_tools";
const CALL_TOOL = "mcp__plugins__call_tool";

function slugFor(pluginId: string): string {
  return (
    pluginId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "plugin"
  );
}

function agentToolName(pluginId: string, toolName: string): string {
  const safeTool = toolName.replace(/[^A-Za-z0-9_-]/g, "_");
  return `mcp__${slugFor(pluginId)}__${safeTool}`.slice(0, 64);
}

const RISK_NOTE: Record<ToolRisk, string> = {
  read: "Read-only.",
  write: "Changes data in the user's account — confirm with the user first unless they asked for this exact action.",
  destructive: "Destructive and may be irreversible — always get explicit confirmation from the user first.",
};

function allowedByMode(connection: PluginConnectionRow, risk: ToolRisk): boolean {
  return connection.permission_mode === "read_write" || risk === "read";
}

type Catalog = Array<{
  connection: PluginConnectionRow;
  tool: PluginConnectionToolRow;
  agentName: string;
}>;

async function loadCatalog(userId: string): Promise<Catalog> {
  const connections = (await repo.listActiveConnectionsForUser(userId)).filter(
    (connection) => connection.status === "active",
  );
  const perConnection = await Promise.all(
    connections.map(async (connection) => {
      let tools = await repo.listConnectionTools(connection.id).catch(() => []);
      if (tools.length === 0) {
        // Connected before discovery finished — try once more now.
        await syncCapabilities(connection.id, userId).catch(() => null);
        tools = await repo.listConnectionTools(connection.id).catch(() => []);
      }
      return tools
        .filter((tool) => allowedByMode(connection, tool.risk_level))
        .map((tool) => ({
          connection,
          tool,
          agentName: agentToolName(connection.plugin_id, tool.tool_name),
        }));
    }),
  );
  return perConnection.flat();
}

function describe(entry: Catalog[number]): string {
  const plugin = entry.connection.plugin_name || entry.connection.plugin_id;
  const account = entry.connection.account_label ? ` (${entry.connection.account_label})` : "";
  return [
    `[${plugin}${account}] ${entry.tool.title || entry.tool.tool_name}.`,
    entry.tool.description,
    RISK_NOTE[entry.tool.risk_level],
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1024);
}

/**
 * Tool definitions to append to the agent's catalog. Empty when the user has
 * no active connections.
 */
export async function buildAgentMcpTools(userId: string): Promise<AgentMcpTool[]> {
  const catalog = await loadCatalog(userId);
  if (catalog.length === 0) return [];

  // Prefer read tools in the direct set; everything stays reachable via search.
  const ordered = [...catalog].sort((a, b) => {
    const rank = { read: 0, write: 1, destructive: 2 } as const;
    return rank[a.tool.risk_level] - rank[b.tool.risk_level];
  });
  const direct = ordered.slice(0, DIRECT_TOOL_LIMIT);
  const tools: AgentMcpTool[] = direct.map((entry) => ({
    type: "function",
    name: entry.agentName,
    description: describe(entry),
    parameters: entry.tool.input_schema ?? { type: "object", properties: {} },
  }));

  if (catalog.length > DIRECT_TOOL_LIMIT) {
    const plugins = [...new Set(catalog.map((entry) => entry.connection.plugin_name))].join(", ");
    tools.push(
      {
        type: "function",
        name: SEARCH_TOOL,
        description: `Search all tools from the user's connected plugins (${plugins}). Use when the tool you need is not listed directly. Returns tool names, descriptions, and input schemas.`,
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "What you want to do, e.g. 'create a Linear issue'." },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        type: "function",
        name: CALL_TOOL,
        description: `Call a plugin tool found with ${SEARCH_TOOL}.`,
        parameters: {
          type: "object",
          properties: {
            tool: { type: "string", description: "Tool name returned by the search, e.g. mcp__linear__create_issue." },
            arguments: { type: "object", description: "Arguments matching the tool's input schema." },
          },
          required: ["tool"],
          additionalProperties: false,
        },
      },
    );
  }
  return tools;
}

/** Resolve an agent tool call to a connection and tool. */
export async function resolveMcpToolCall(
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ResolvedMcpTarget | { meta: "search"; query: string } | null> {
  if (toolName === SEARCH_TOOL) {
    return { meta: "search", query: typeof args.query === "string" ? args.query : "" };
  }
  let name = toolName;
  let callArgs = args;
  if (toolName === CALL_TOOL) {
    name = typeof args.tool === "string" ? args.tool : "";
    callArgs =
      args.arguments && typeof args.arguments === "object" && !Array.isArray(args.arguments)
        ? (args.arguments as Record<string, unknown>)
        : {};
  }
  if (!name.startsWith("mcp__")) return null;

  const catalog = await loadCatalog(userId);
  const entry = catalog.find((candidate) => candidate.agentName === name);
  if (!entry) return null;
  return { connection: entry.connection, tool: entry.tool, args: callArgs };
}

async function searchTools(userId: string, queryText: string): Promise<unknown> {
  const catalog = await loadCatalog(userId);
  const words = queryText.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const scored = catalog
    .map((entry) => {
      const haystack = `${entry.connection.plugin_name} ${entry.tool.tool_name} ${entry.tool.title} ${entry.tool.description}`.toLowerCase();
      const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter((item) => item.score > 0 || words.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  return {
    tools: scored.map(({ entry }) => ({
      name: entry.agentName,
      plugin: entry.connection.plugin_name,
      description: describe(entry),
      input_schema: entry.tool.input_schema,
    })),
    usage: `Call one with ${CALL_TOOL} using its name and arguments.`,
  };
}

// ─── execution ──────────────────────────────────────────────────────────────

async function runTool(
  target: ResolvedMcpTarget,
  accessToken: string,
): Promise<{ text: string; isError: boolean }> {
  const { connection, tool, args } = target;

  if (connection.connector_kind === "rest") {
    const sealed = await repo.readSealedTokens(connection.id);
    const toolset = sealed?.oauth_meta?.toolset as RestToolsetId | undefined;
    const restTool = toolset ? findRestTool(toolset, tool.tool_name) : null;
    if (!restTool) return { text: "This tool is no longer available.", isError: true };
    try {
      const result = await restTool.run(createRestApi(accessToken), args);
      return {
        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        isError: false,
      };
    } catch (error) {
      if (error instanceof RestApiError && (error.status === 401 || error.status === 403)) {
        throw error;
      }
      return {
        text: error instanceof Error ? error.message : "The request failed.",
        isError: true,
      };
    }
  }

  if (!connection.mcp_url) return { text: "This plugin has no server address.", isError: true };
  const result = await callMcpTool(connection.mcp_url, accessToken, tool.tool_name, args);
  if (!result.ok) {
    if (result.code === "unauthorized" || result.code === "forbidden") {
      throw new RestApiError(result.message, result.code === "unauthorized" ? 401 : 403);
    }
    return { text: result.message, isError: true };
  }
  return { text: mcpResultToText(result.value), isError: result.value.isError };
}

function reconnectMessage(pluginName: string): string {
  return `The "${pluginName}" plugin needs to be reconnected. Ask the user to reconnect it from the Plugins page.`;
}

/** Run one plugin tool call through the firewall. Never throws. */
export async function executeMcpToolCall(
  userId: string,
  target: ResolvedMcpTarget | { meta: "search"; query: string },
): Promise<McpExecutionOutcome> {
  if ("meta" in target) {
    return {
      output: await searchTools(userId, target.query),
      isError: false,
      pluginName: "Plugins",
    };
  }

  const { connection, tool, args } = target;
  const pluginName = connection.plugin_name || connection.plugin_id;
  const risk = tool.risk_level;
  const started = Date.now();

  const trace = (status: "ok" | "error" | "blocked", detail: string | null) =>
    repo
      .recordToolCall({
        userId,
        connectionId: connection.id,
        pluginId: connection.plugin_id,
        toolName: tool.tool_name,
        risk,
        status,
        detail,
        durationMs: Date.now() - started,
      })
      .catch(() => null);

  const blocked = async (reason: string): Promise<McpExecutionOutcome> => {
    await trace("blocked", reason);
    return { output: { blocked: true, reason }, isError: true, pluginName };
  };

  if (!allowedByMode(connection, risk)) {
    return blocked(`${pluginName} is set to read-only. The user can allow changes on the Plugins page.`);
  }
  const argumentCheck = inspectArguments(args, risk);
  if (argumentCheck.blocked) return blocked(argumentCheck.reason);
  const rateCheck = await checkRateLimit(userId, risk);
  if (rateCheck.blocked) return blocked(rateCheck.reason);

  let token = await getAccessToken(connection);
  if (!token.ok) {
    await trace("error", "reauthorization_required");
    return { output: reconnectMessage(pluginName), isError: true, pluginName };
  }

  let result: { text: string; isError: boolean };
  try {
    try {
      result = await runTool(target, token.accessToken);
    } catch (error) {
      if (!(error instanceof RestApiError)) throw error;
      // One retry with a freshly refreshed token before asking to reconnect.
      token = await getAccessToken(connection, { forceRefresh: true });
      if (!token.ok) {
        await trace("error", "reauthorization_required");
        return { output: reconnectMessage(pluginName), isError: true, pluginName };
      }
      result = await runTool(target, token.accessToken);
    }
  } catch {
    await repo.setConnectionStatus(connection.id, "reauthorization_required", "unauthorized");
    await trace("error", "unauthorized");
    return { output: reconnectMessage(pluginName), isError: true, pluginName };
  }

  const plain = await readPlainTokens(connection.id).catch(() => null);
  const sanitized = sanitizeUntrustedOutput(
    result.text,
    [plain?.accessToken, plain?.refreshToken].filter((value): value is string => Boolean(value)),
  );

  await trace(result.isError ? "error" : "ok", result.isError ? sanitized.text.slice(0, 200) : null);
  await repo.touchConnectionUsage(connection.id).catch(() => null);

  return {
    output: {
      plugin: pluginName,
      tool: tool.tool_name,
      notice: UNTRUSTED_CONTENT_NOTICE,
      ...(sanitized.removedInstructions > 0
        ? { firewall: `${sanitized.removedInstructions} embedded instruction(s) were removed from this content.` }
        : {}),
      content: sanitized.text,
      ...(result.isError ? { error: true } : {}),
    },
    isError: result.isError,
    pluginName,
  };
}
