import { createHash } from "node:crypto";
import { McpClient } from "@/connectors/server/mcp/client";
import { listMcpServers } from "@/connectors/server/mcp/types";
import type { McpCallResult, McpToolDescriptor } from "@/connectors/server/mcp/types";
import {
  callConnectorGatewayTool,
  connectorGatewayConfigured,
  listConnectorGatewayTools,
} from "@/connectors/server/gateway";
import { openPluginApiKey } from "@/connectors/server/plugins/api-key-crypto";
import { query, queryOne } from "@/server/db/pool";

type ToolTarget =
  | { kind: "mcp"; serverId: string; name: string }
  | { kind: "gateway"; connectorKey: string; name: string }
  | {
      kind: "direct";
      installationId: string;
      connectorKey: string;
      connectorName: string;
      mcpUrl: string;
      name: string;
      mcpName: string;
      mcpKind: string | null;
    };

type DirectToolRow = {
  connectorKey: string;
  connectorName: string;
  mcpUrl: string;
  installationId: string;
  toolName: string;
  toolTitle: string;
  description: string;
  inputSchema: unknown;
  mcpKind: string | null;
  mcpToolName: string | null;
};

/** Cap direct tool output so one chatty server cannot flood the context. */
const DIRECT_TOOL_OUTPUT_MAX_CHARS = 100_000;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalValue(item)]),
  );
}

function argumentsHash(args: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalValue(args)), "utf8")
    .digest("hex");
}

function truncateOutput(text: string): string {
  if (text.length <= DIRECT_TOOL_OUTPUT_MAX_CHARS) return text;
  return `${text.slice(0, DIRECT_TOOL_OUTPUT_MAX_CHARS)}\n\n…(output truncated, ${text.length} chars total)`;
}

/**
 * Per-turn MCP connector harness. Discovers tools from env-configured MCP
 * servers (CLAUXEN_MCP_SERVERS) plus the user's installed plugins — via the
 * connector gateway when configured, else straight from Postgres with direct
 * streamable-HTTP calls. Exposes everything as mcp__<serverId>__<toolName>.
 * Sources that fail are skipped so one bad connector never sinks a turn.
 */
export class McpConnectorHarness {
  private clients = new Map<string, McpClient>();
  private directClients = new Map<string, McpClient>();
  private toolIndex = new Map<string, ToolTarget>();
  private discovered: McpToolDescriptor[] = [];
  private ready = false;

  constructor(private readonly options: { userId?: string } = {}) {}

  hasSources(): boolean {
    return listMcpServers().length > 0 || Boolean(this.options.userId);
  }

  /** Connect to all configured servers and discover their tools. */
  async discover(): Promise<McpToolDescriptor[]> {
    if (this.ready) return this.discovered;
    this.ready = true;
    const servers = listMcpServers();
    const discoveries: Array<Promise<void>> = servers.map(async (config) => {
      const client = new McpClient(config);
      try {
        const tools = await client.listTools();
        this.clients.set(config.id, client);
        for (const tool of tools) {
          const qualifiedName = `mcp__${config.id}__${tool.name}`.replace(
            /[^a-zA-Z0-9_-]/g,
            "_",
          );
          if (this.toolIndex.has(qualifiedName)) continue;
          this.toolIndex.set(qualifiedName, {
            kind: "mcp",
            serverId: config.id,
            name: tool.name,
          });
          this.discovered.push({
            qualifiedName,
            serverId: config.id,
            name: tool.name,
            description:
              tool.description ||
              `Tool ${tool.name} from the ${config.id} connector.`,
            inputSchema: tool.inputSchema,
          });
        }
      } catch {
        // unreachable / misconfigured server — skip it for this turn
      }
    });

    if (this.options.userId) {
      if (connectorGatewayConfigured()) {
        discoveries.push(this.discoverViaGateway(this.options.userId));
      } else {
        discoveries.push(this.discoverDirect(this.options.userId));
      }
    }

    await Promise.all(discoveries);
    return this.discovered;
  }

  private async discoverViaGateway(userId: string): Promise<void> {
    try {
      const tools = await listConnectorGatewayTools(userId);
      for (const tool of tools) {
        if (this.toolIndex.has(tool.qualifiedName)) continue;
        this.toolIndex.set(tool.qualifiedName, {
          kind: "gateway",
          connectorKey: tool.connectorKey,
          name: tool.toolName,
        });
        this.discovered.push({
          qualifiedName: tool.qualifiedName,
          serverId: tool.connectorKey,
          name: tool.toolName,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
    } catch {
      // The connector gateway is optional for a turn; built-in tools remain available.
    }
  }

  private async discoverDirect(userId: string): Promise<void> {
    try {
      const rows = await query<DirectToolRow>(
        `select catalog.key as "connectorKey", catalog.name as "connectorName",
                catalog.mcp_url as "mcpUrl",
                installation.id as "installationId",
                tool.name as "toolName", tool.title as "toolTitle",
                tool.description, tool.input_schema as "inputSchema",
                tool.metadata->>'kind' as "mcpKind",
                tool.metadata->>'mcpName' as "mcpToolName"
         from public.connector_installations installation
         join public.connector_catalog catalog on catalog.id = installation.connector_id
         join public.connector_tools tool on tool.connector_id = catalog.id
         left join public.connector_tool_permissions permission
           on permission.installation_id = installation.id
          and permission.tool_name = tool.name
         where installation.user_id = $1::uuid
           and installation.status = 'active'
           and catalog.protocol = 'mcp'
           and catalog.mcp_url is not null
           and tool.is_enabled = true
           and coalesce(permission.policy, 'inherit') <> 'deny'
           and not exists (
             select 1 from private.connector_credentials credential
             where credential.installation_id = installation.id
           )
         order by catalog.key, tool.name
         limit 500`,
        [userId],
      );
      for (const row of rows) {
        const qualifiedName =
          `mcp__${row.connectorKey.replace(/[^a-zA-Z0-9_-]/g, "_")}__${row.toolName}`;
        if (this.toolIndex.has(qualifiedName)) continue;
        let inputSchema: Record<string, unknown> = {
          type: "object",
          properties: {},
        };
        if (row.inputSchema && typeof row.inputSchema === "object") {
          inputSchema = row.inputSchema as Record<string, unknown>;
        } else if (typeof row.inputSchema === "string") {
          try {
            const parsed = JSON.parse(row.inputSchema) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              inputSchema = parsed as Record<string, unknown>;
            }
          } catch {
            // keep empty object schema
          }
        }
        const kindLabel =
          row.mcpKind === "skill" ? "MCP skill" : "MCP tool";
        this.toolIndex.set(qualifiedName, {
          kind: "direct",
          installationId: row.installationId,
          connectorKey: row.connectorKey,
          connectorName: row.connectorName,
          mcpUrl: row.mcpUrl,
          name: row.toolName,
          mcpName: row.mcpToolName || row.toolName,
          mcpKind: row.mcpKind,
        });
        this.discovered.push({
          qualifiedName,
          serverId: row.connectorKey,
          name: row.toolName,
          description: `${row.description || row.toolName} ${kindLabel} from ${row.connectorName}. Connected Clauxen plugin: ${row.connectorName}.`,
          inputSchema,
        });
      }
    } catch {
      // Local installs are optional for a turn; built-in tools remain available.
    }
  }

  /** Route a qualified mcp__* call to its server. */
  async call(
    qualifiedName: string,
    args: Record<string, unknown>,
  ): Promise<McpCallResult> {
    const target = this.toolIndex.get(qualifiedName);
    if (!target) {
      return { text: `Unknown MCP tool: ${qualifiedName}`, isError: true };
    }
    if (target.kind === "gateway") {
      if (!this.options.userId) {
        return {
          text: "Connector user context is unavailable.",
          isError: true,
        };
      }
      try {
        const outcome = await callConnectorGatewayTool(this.options.userId, {
          connectorKey: target.connectorKey,
          toolName: target.name,
          arguments: args,
        });
        if (outcome.requiresApproval) {
          return {
            text: `${outcome.text} Approval ID: ${outcome.approvalId ?? "unavailable"}. The user must approve this action in Clauxen before it can run.`,
            isError: true,
          };
        }
        return { text: outcome.text, isError: outcome.isError };
      } catch (error) {
        return {
          text: `Connector call failed: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    }
    if (target.kind === "direct") {
      return this.callDirect(target, args);
    }

    const client = this.clients.get(target.serverId);
    if (!client) {
      return {
        text: `MCP server "${target.serverId}" is not connected in this turn.`,
        isError: true,
      };
    }
    try {
      return await client.callTool(target.name, args);
    } catch (error) {
      return {
        text: `MCP call failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  private async callDirect(
    target: Extract<ToolTarget, { kind: "direct" }>,
    args: Record<string, unknown>,
  ): Promise<McpCallResult> {
    const userId = this.options.userId;
    if (!userId) {
      return { text: "Connector user context is unavailable.", isError: true };
    }
    try {
      const row = await queryOne<{
        tool_title: string;
        risk_level: string;
        requires_confirmation: boolean;
        permission_policy: string | null;
      }>(
        `select tool.title as tool_title, tool.risk_level,
                tool.requires_confirmation, permission.policy as permission_policy
         from public.connector_installations installation
         join public.connector_catalog catalog on catalog.id = installation.connector_id
         join public.connector_tools tool on tool.connector_id = catalog.id
         left join public.connector_tool_permissions permission
           on permission.installation_id = installation.id
          and permission.tool_name = tool.name
         where installation.id = $1::uuid
           and installation.user_id = $2::uuid
           and installation.status = 'active'
           and tool.name = $3
           and tool.is_enabled = true
         limit 1`,
        [target.installationId, userId, target.name],
      );
      if (!row) {
        return { text: `Unknown MCP tool: ${target.name}`, isError: true };
      }
      if (row.permission_policy === "deny") {
        return { text: "This tool is disabled for your account.", isError: true };
      }
      const needsApproval =
        row.permission_policy === "confirm" ||
        row.requires_confirmation ||
        row.risk_level === "write" ||
        row.risk_level === "destructive" ||
        row.risk_level === "sensitive";
      if (needsApproval) {
        const approval = await queryOne<{ id: string; expires_at: string }>(
          `insert into public.connector_action_approvals
             (user_id, installation_id, tool_name, arguments_hash)
           values ($1::uuid, $2::uuid, $3, $4)
           returning id, expires_at`,
          [userId, target.installationId, target.name, argumentsHash(args)],
        );
        return {
          text: `Confirmation is required before Clauxen can run ${row.tool_title}. Approval ID: ${approval?.id ?? "unavailable"}. The user must approve this action in Clauxen before it can run.`,
          isError: true,
        };
      }

      let client = this.directClients.get(target.installationId);
      if (!client) {
        const headers: Record<string, string> = {};
        const sealed = await queryOne<{
          encrypted_api_key: string;
          api_key_nonce: string;
          encryption_key_version: number;
        }>(
          `select encrypted_api_key, api_key_nonce, encryption_key_version
           from private.plugin_mcp_api_keys
           where installation_id = $1::uuid`,
          [target.installationId],
        ).catch(() => null);
        if (sealed) {
          try {
            const apiKey = openPluginApiKey(
              {
                ciphertext: sealed.encrypted_api_key,
                nonce: sealed.api_key_nonce,
                version: sealed.encryption_key_version,
              },
              target.installationId,
            );
            headers["Authorization"] = `Bearer ${apiKey}`;
          } catch {
            return {
              text: `The stored API key for ${target.connectorName} could not be read. Remove and re-add the plugin with a new key.`,
              isError: true,
            };
          }
        }
        client = new McpClient({
          id: target.connectorKey,
          url: target.mcpUrl,
          headers,
        });
        this.directClients.set(target.installationId, client);
      }
      const outcome =
        target.mcpKind === "skill"
          ? await client.getPrompt(target.mcpName, args)
          : await client.callTool(target.mcpName, args);
      await query(
        `update public.connector_installations
         set last_used_at = now(),
             last_error_code = $2,
             last_error_at = case when $2 is null then null else now() end,
             updated_at = now()
         where id = $1::uuid`,
        [target.installationId, outcome.isError ? "mcp_tool_error" : null],
      ).catch(() => undefined);
      await query(
        `insert into public.connector_audit_events
           (user_id, installation_id, connector_key, event_type, tool_name, status, error_code)
         values ($1::uuid, $2::uuid, $3, 'tool_called', $4, $5, $6)`,
        [
          userId,
          target.installationId,
          target.connectorKey,
          target.name,
          outcome.isError ? "failed" : "succeeded",
          outcome.isError ? "mcp_tool_error" : null,
        ],
      ).catch(() => undefined);
      return { text: truncateOutput(outcome.text), isError: outcome.isError };
    } catch (error) {
      return {
        text: `MCP call failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  /** Tear down all sessions (end of turn). */
  async close(): Promise<void> {
    await Promise.all(
      [...this.clients.values(), ...this.directClients.values()].map((client) =>
        client.close(),
      ),
    );
    this.clients.clear();
    this.directClients.clear();
    this.toolIndex.clear();
    this.discovered = [];
    this.ready = false;
  }
}
