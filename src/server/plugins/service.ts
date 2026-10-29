import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ConnectorApproval, ConnectorAvailability, ConnectorConnection, ConnectorId, ConnectorTool } from "@/lib/plugin-connectors";
import { executeGitHubAgent } from "@/server/github/agent";
import { CONNECTORS, getConnector } from "./registry";
import { executeRestTool, listRestTools } from "./rest-tools";
import { connectorEnv, connectorError, hashState, sanitizeResult, seal, sealKey, unseal, type SealBinding } from "./crypto";
import { connectorRepository, type ActionRow, type ConnectionRow, type ConnectorRepository, type ConnectionUpdate } from "./repository";
import { accountLabel, appOrigin, assertMutationOrigin, authorizationUrl, callbackPath, exchangeToken, FLOW_COOKIE, flowCookie, newOAuthState, oauthClient, readFlowCookie, revokeRestCredential, type Definition, type OAuthCredential } from "./oauth";
import { authorizeMcp, ConnectorOAuthProvider, mapMcpTools, withMcpClient, type McpCredentialState } from "./mcp";

export type ConnectorCredentials = { transport: "rest"; rest: OAuthCredential } | { transport: "mcp"; mcp: McpCredentialState } | { transport: "github" };
type FlowData = { origin: string; verifier: string; mcp?: McpCredentialState };
type ToolOutput = { output: unknown; pauseForUser?: boolean; clarificationQuestion?: string };
type Dependencies = {
  repository: ConnectorRepository; resolve: typeof connectorEnv; fetch: typeof fetch; key: () => Buffer; now: () => number;
  restTools: typeof listRestTools; executeRest: typeof executeRestTool; executeGitHub: typeof executeGitHubAgent;
  authorizeMcp: typeof authorizeMcp;
};

const uuid = z.uuid();
const githubTools: ConnectorTool[] = [
  { name: "repositories", title: "List GitHub repositories", description: "List repositories available through the existing GitHub App.", readOnly: true, inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "read", title: "Read GitHub repository", description: "Read a connected repository through the existing GitHub App.", readOnly: true, inputSchema: { type: "object", properties: { owner: { type: "string", pattern: "^[a-zA-Z0-9_.-]{1,100}$" }, repo: { type: "string", pattern: "^[a-zA-Z0-9_.-]{1,100}$" } }, required: ["owner", "repo"], additionalProperties: false } },
  { name: "change", title: "Create GitHub pull request", description: "Create a new branch and pull request with the exact proposed files. Requires approval; never merges.", readOnly: false, inputSchema: {
    type: "object", additionalProperties: false, required: ["owner", "repo", "request_id", "base_branch", "expected_head_sha", "title", "files"], properties: {
      owner: { type: "string", pattern: "^[a-zA-Z0-9_.-]{1,100}$" }, repo: { type: "string", pattern: "^[a-zA-Z0-9_.-]{1,100}$" }, request_id: { type: "string", format: "uuid" },
      base_branch: { type: "string", minLength: 1, maxLength: 200, pattern: "^[a-zA-Z0-9_./-]+$" }, expected_head_sha: { type: "string", pattern: "^[0-9a-f]{40}$" },
      title: { type: "string", minLength: 1, maxLength: 200, pattern: "^[^\\r\\n]+$" }, body: { type: "string", maxLength: 30000 },
      files: { type: "array", minItems: 1, maxItems: 30, items: { type: "object", additionalProperties: false, required: ["path", "content"], properties: { path: { type: "string", minLength: 1, maxLength: 500 }, content: { type: "string", maxLength: 200000 } } } },
    },
  } },
];

function binding(userId: string, pluginId: string, purpose: string, id: string): SealBinding { return { userId, pluginId, purpose, id }; }
function publicConnection(row: ConnectionRow): ConnectorConnection {
  return { id: row.id, pluginId: row.plugin_id, accountLabel: row.account_label, status: row.status, grantedScopes: row.granted_scopes, connectedAt: new Date(row.connected_at).toISOString() };
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function credentialSecrets(credentials: ConnectorCredentials): string[] {
  if (credentials.transport === "github") return [];
  if (credentials.transport === "rest") return [credentials.rest.accessToken, credentials.rest.refreshToken ?? ""];
  const state = credentials.mcp;
  return [state.tokens?.access_token ?? "", state.tokens?.refresh_token ?? "", state.client?.client_secret ?? "", state.verifier ?? "", (state.client as Record<string, unknown> | undefined)?.registration_access_token as string ?? ""].filter(Boolean);
}
function safeJsonArguments(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw connectorError("Tool arguments must be a JSON object.");
  let nodes = 0;
  const visit = (value: unknown, depth: number): void => {
    if (++nodes > 10000 || depth > 12) throw connectorError("Tool arguments exceed the safety limit.");
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (Array.isArray(value)) { value.forEach((entry) => visit(entry, depth + 1)); return; }
    if (value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      for (const [key, entry] of Object.entries(value)) { if (["__proto__", "prototype", "constructor"].includes(key)) throw connectorError("Invalid argument property."); visit(entry, depth + 1); }
      return;
    }
    throw connectorError("Tool arguments must contain only JSON values.");
  };
  visit(input, 0);
  const text = JSON.stringify(input);
  if (Buffer.byteLength(text) > 131072) throw connectorError("Tool arguments exceed the safety limit.");
  return JSON.parse(text) as Record<string, unknown>;
}

export function validateToolArguments(tool: ConnectorTool, input: unknown): Record<string, unknown> {
  const args = safeJsonArguments(input);
  try {
    if (!z.fromJSONSchema(tool.inputSchema).safeParse(args).success) throw new Error();
  } catch { throw connectorError(`Invalid arguments for ${tool.name}. Review the tool's input schema.`); }
  if (tool.name === "change") {
    const files = args.files as { path: string }[] | undefined;
    if (files && (new Set(files.map((file) => file.path)).size !== files.length || files.some(({ path }) => path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..") || /^\.git(?:\/|$)|^\.github\/workflows\//.test(path)))) throw connectorError("Invalid GitHub file paths or duplicated files.");
  }
  return args;
}

/** Factory is for isolated dependency-injected tests; production exports below use real pg/SDK. */
export function createConnectorService(overrides: Partial<Dependencies> = {}) {
  const deps: Dependencies = { repository: connectorRepository, resolve: connectorEnv, fetch, key: sealKey, now: Date.now, restTools: listRestTools, executeRest: executeRestTool, executeGitHub: executeGitHubAgent, authorizeMcp, ...overrides };
  const repo = deps.repository;
  const origin = () => appOrigin(deps.resolve);
  const requireUser = (userId: string) => { if (!uuid.safeParse(userId).success) throw connectorError("Authentication required.", 401); };
  const definitionFor = (pluginId: string) => { const value = getConnector(pluginId); if (!value) throw connectorError("This connector is not supported.", 404); return value; };
  const credentialsFor = (row: ConnectionRow) => {
    const value = unseal<ConnectorCredentials>(row.credentials_sealed, binding(row.user_id, row.plugin_id, "credentials", row.id), deps.key());
    if (value.transport !== definitionFor(row.plugin_id).transport) throw connectorError("Connector credential type did not match. Reconnect this account.", 409);
    return value;
  };
  const saveValue = (row: ConnectionRow, credentials: ConnectorCredentials, status = row.status, metadata = row.metadata): ConnectionUpdate => ({
    credentials_sealed: seal(credentials, binding(row.user_id, row.plugin_id, "credentials", row.id), deps.key()),
    account_label: row.account_label, granted_scopes: row.granted_scopes, metadata, status,
  });
  const toApproval = (row: ActionRow, secrets: string[] = []): ConnectorApproval => ({
    id: row.id, pluginId: row.plugin_id, toolName: row.tool_name, title: row.title,
    arguments: row.arguments_sealed ? sanitizeResult(unseal(row.arguments_sealed, binding(row.user_id, row.plugin_id, "arguments", row.id), deps.key()), secrets) as Record<string, unknown> : {},
    status: row.status, expiresAt: new Date(row.expires_at).toISOString(),
    ...(row.result_sealed ? { result: sanitizeResult(unseal(row.result_sealed, binding(row.user_id, row.plugin_id, "result", row.id), deps.key()), secrets) } : {}),
  });
  async function syncGitHub(userId: string): Promise<{ configured: boolean; login: string | null }> {
    const details = await repo.githubDetails(userId);
    const existing = await repo.getConnection(userId, "github");
    if (details.login && (!existing || existing.account_label !== details.login || existing.status !== "active")) {
      const id = existing?.id ?? randomUUID();
      await repo.saveConnection(userId, "github", id, { account_label: details.login.slice(0, 200), status: "active", granted_scopes: [], metadata: {}, credentials_sealed: seal({ transport: "github" }, binding(userId, "github", "credentials", id), deps.key()) });
    } else if (!details.login && existing) {
      await repo.withLockedConnection(userId, existing.id, async (row, save) => { await save(saveValue(row, { transport: "github" }, "reauthorization_required")); });
    }
    return details;
  }
  async function availability(githubConfigured: boolean): Promise<ConnectorAvailability[]> {
    return CONNECTORS.map((definition) => {
      let reason: string | undefined;
      try {
        deps.key(); origin();
        if (definition.transport === "rest") oauthClient(definition, deps.resolve);
        if (definition.transport === "github" && !githubConfigured) reason = "Finish the existing GitHub App setup at /github/setup.";
      } catch (error) { reason = error instanceof Error && error.name === "AppError" ? error.message : "Connector setup is incomplete."; }
      return { pluginId: definition.id, name: definition.name, transport: definition.transport, registrationUrl: definition.registrationUrl, scopes: definition.oauth?.scopes ?? [], ready: !reason, ...(reason ? { reason } : {}) };
    });
  }
  async function requiredConnection(userId: string, definition: Definition): Promise<ConnectionRow> {
    if (definition.transport === "github") await syncGitHub(userId);
    const connection = await repo.getConnection(userId, definition.id);
    if (!connection || connection.status !== "active") throw connectorError(`Connect ${definition.name} from Plugins before using this tool.`, 409);
    return connection;
  }
  async function accessCredential(userId: string, connection: ConnectionRow): Promise<OAuthCredential> {
    const result = await repo.withLockedConnection(userId, connection.id, async (row, save) => {
      if (row.status !== "active") return { error: true } as const;
      const credentials = credentialsFor(row);
      if (credentials.transport !== "rest") throw connectorError("This connector does not use a REST token.");
      const token = credentials.rest;
      if (token.expiresAt === null || token.expiresAt > deps.now() + 60000) return { token };
      if (!token.refreshToken) { await save(saveValue(row, credentials, "reauthorization_required")); return { error: true } as const; }
      try {
        // One bounded (8s) refresh under a row lock; credential omission preserves refresh.
        const refreshed = await exchangeToken(definitionFor(row.plugin_id), { origin: origin(), previous: token, fetch: deps.fetch, resolve: deps.resolve });
        const update = saveValue(row, { transport: "rest", rest: refreshed.credential });
        update.granted_scopes = refreshed.credential.scopes;
        await save(update);
        return { token: refreshed.credential };
      } catch {
        await save(saveValue(row, credentials, "reauthorization_required"));
        return { error: true } as const;
      }
    });
    if ("error" in result) throw connectorError("Authorization expired. Reconnect this account from Plugins.", 409);
    return result.token;
  }
  async function mcpOperation<T>(userId: string, connection: ConnectionRow, operation: (client: Parameters<Parameters<typeof withMcpClient>[2]>[0], signal: AbortSignal, credentials: ConnectorCredentials) => Promise<T>): Promise<T> {
    const result = await repo.withLockedConnection(userId, connection.id, async (row, save) => {
      if (row.status !== "active") return { error: true } as const;
      const credentials = credentialsFor(row);
      if (credentials.transport !== "mcp") throw connectorError("This connector is not an MCP resource.");
      const provider = new ConnectorOAuthProvider(definitionFor(row.plugin_id), origin(), credentials.mcp, undefined, async () => { await save(saveValue(row, credentials)); });
      try {
        const value = await withMcpClient(definitionFor(row.plugin_id), provider, (client, signal) => operation(client, signal, credentials));
        return { value };
      } catch {
        if (!credentials.mcp.tokens) await save(saveValue(row, credentials, "reauthorization_required"));
        return { error: true } as const;
      }
    });
    if ("error" in result) throw connectorError("MCP request could not complete. Reconnect the account or try a narrower request.", 502);
    return result.value;
  }
  async function toolsFor(userId: string, definition: Definition, connection?: ConnectionRow): Promise<ConnectorTool[]> {
    if (definition.transport === "github") return githubTools;
    if (definition.transport === "rest") return deps.restTools(definition.id);
    if (!connection) return [];
    const cache = connection.metadata.toolCache as { expiresAt?: number; tools?: ConnectorTool[] } | undefined;
    if (cache?.expiresAt && cache.expiresAt > deps.now() && Array.isArray(cache.tools)) return cache.tools.slice(0, 100);
    const tools = await mcpOperation(userId, connection, async (client, signal, credentials) => {
      const listed = await client.listTools({}, { timeout: 8000, signal });
      return sanitizeResult(mapMcpTools(listed.tools, definition), credentialSecrets(credentials)) as ConnectorTool[];
    });
    if (!Array.isArray(tools)) throw connectorError("MCP tool metadata exceeded the safety limit.", 502);
    await repo.withLockedConnection(userId, connection.id, async (row, save) => {
      if (String(row.revision) === String(connection.revision)) await save(saveValue(row, credentialsFor(row), row.status, { ...row.metadata, toolCache: { expiresAt: deps.now() + 300000, tools } }));
    });
    return tools;
  }
  async function execute(userId: string, definition: Definition, connection: ConnectionRow, tool: ConnectorTool, args: Record<string, unknown>): Promise<unknown> {
    // Recheck ownership/connection epoch immediately before execution, never accept tokens from input.
    const latest = await requiredConnection(userId, definition);
    if (latest.id !== connection.id || String(latest.revision) !== String(connection.revision)) throw connectorError("Connection changed. Request a new approval.", 409);
    if (definition.transport === "github") {
      try { return sanitizeResult(await deps.executeGitHub(userId, tool.name === "change" ? "create_change" : tool.name, args)); }
      catch { throw connectorError("GitHub operation could not complete. Check /github; a write's outcome may be unknown.", 502); }
    }
    if (definition.transport === "mcp") return mcpOperation(userId, connection, async (client, signal, credentials) => {
      const result = await client.callTool({ name: tool.name, arguments: args }, undefined, { timeout: 8000, signal });
      if (result.isError) throw connectorError("MCP tool reported a failure.", 502);
      return sanitizeResult(result, credentialSecrets(credentials));
    });
    const token = await accessCredential(userId, connection);
    const deadline = AbortSignal.timeout(8000);
    const boundedFetch: typeof fetch = (input, init) => deps.fetch(input, { ...init, redirect: "manual", signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline });
    try { return sanitizeResult(await deps.executeRest(definition.id, tool.name, args, { accessToken: token.accessToken, fetch: boundedFetch }), [token.accessToken, token.refreshToken ?? ""]); }
    catch { throw connectorError("Provider operation failed. Check account permissions; a write's outcome may be unknown.", 502); }
  }

  return {
    async getConnectorOverview(userId: string): Promise<{ availability: ConnectorAvailability[]; connections: ConnectorConnection[]; approvals: ConnectorApproval[] }> {
      requireUser(userId);
      // Missing encryption setup should still produce actionable availability metadata.
      let githubConfigured = false;
      try { githubConfigured = (await syncGitHub(userId)).configured; } catch { /* Readiness below remains fail closed. */ }
      const [available, connections, actions] = await Promise.all([availability(githubConfigured), repo.listConnections(userId), repo.listActions(userId)]);
      const secrets = connections.flatMap((row) => { try { return credentialSecrets(credentialsFor(row)); } catch { return []; } });
      return { availability: available, connections: connections.map(publicConnection), approvals: actions.map((row) => toApproval(row, secrets)) };
    },
    async beginConnectorConnect(userId: string, pluginId: string, request: Request): Promise<Response> {
      requireUser(userId); const definition = definitionFor(pluginId); const canonical = origin();
      if (request.method !== "POST") throw connectorError("Use a same-origin form POST to connect.", 405);
      assertMutationOrigin(request, canonical);
      const contentType = request.headers.get("content-type")?.split(";")[0].trim();
      if (!["application/x-www-form-urlencoded", "multipart/form-data"].includes(contentType ?? "")) throw connectorError("Use the Connect form to start authorization.", 415);
      if (definition.transport === "github") return new Response(null, { status: 303, headers: { Location: canonical + "/github", "Cache-Control": "no-store" } });
      deps.key();
      const { state, browser, verifier } = newOAuthState(); const id = randomUUID();
      const data: FlowData = { origin: canonical, verifier };
      let target: URL;
      if (definition.transport === "mcp") {
        const existing = await repo.getConnection(userId, definition.id);
        const previous = existing ? credentialsFor(existing) : undefined;
        data.mcp = previous?.transport === "mcp" ? { client: previous.mcp.client, discovery: previous.mcp.discovery } : {};
        const url = await deps.authorizeMcp(definition, canonical, state, data.mcp);
        if (!url) throw connectorError("MCP authorization is not available.", 502);
        target = url;
      } else target = authorizationUrl(definition, canonical, state, verifier, deps.resolve);
      await repo.putState({ id, user_id: userId, plugin_id: definition.id, state_hash: hashState(state), browser_hash: hashState(browser), data_sealed: seal(data, binding(userId, definition.id, "oauth-state", id), deps.key()) });
      return new Response(null, { status: 303, headers: { Location: target.href, "Set-Cookie": flowCookie(browser), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    },
    async completeConnectorConnect(userId: string, pluginId: string, request: Request): Promise<Response> {
      requireUser(userId);
      const definition = definitionFor(pluginId); const canonical = origin();
      let success = false;
      let stage = "validate_callback";
      try {
        const url = new URL(request.url); const state = url.searchParams.get("state") ?? ""; const browser = readFlowCookie(request);
        if (request.method !== "GET" || url.origin !== canonical || url.pathname !== callbackPath(definition.id) || !/^[A-Za-z0-9_-]{43}$/.test(state) || !browser || url.searchParams.getAll("state").length !== 1) throw connectorError("Invalid OAuth callback.");
        stage = "consume_state";
        const stored = await repo.consumeState(userId, definition.id, hashState(state), hashState(browser));
        if (!stored) throw connectorError("OAuth state expired or was already used.");
        stage = "decrypt_state";
        const data = unseal<FlowData>(stored.data_sealed, binding(userId, definition.id, "oauth-state", stored.id), deps.key());
        if (data.origin !== canonical || url.searchParams.has("error")) throw connectorError("Provider authorization was declined.");
        const code = url.searchParams.get("code");
        if (!code || code.length > 4096 || /[\r\n\u0000]/.test(code) || url.searchParams.getAll("code").length !== 1) throw connectorError("Missing authorization code.");
        stage = "load_connection";
        const previous = await repo.getConnection(userId, definition.id); const id = previous?.id ?? randomUUID();
        let credentials: ConnectorCredentials; let label: string; let scopes: string[];
        stage = "exchange_token";
        if (definition.transport === "mcp" && data.mcp) {
          await deps.authorizeMcp(definition, canonical, state, data.mcp, code);
          if (!data.mcp.tokens) throw connectorError("MCP authorization did not return credentials.");
          delete data.mcp.verifier;
          credentials = { transport: "mcp", mcp: data.mcp }; label = `${definition.name} account`; scopes = (data.mcp.tokens.scope ?? "").split(" ").filter(Boolean).slice(0, 100);
        } else if (definition.transport === "rest") {
          const prior = previous ? credentialsFor(previous) : undefined;
          const exchanged = await exchangeToken(definition, { origin: canonical, code, verifier: data.verifier, previous: prior?.transport === "rest" ? prior.rest : undefined, fetch: deps.fetch, resolve: deps.resolve });
          credentials = { transport: "rest", rest: exchanged.credential }; scopes = exchanged.credential.scopes;
          label = await accountLabel(definition, exchanged.credential, exchanged.response, deps.fetch);
        } else throw connectorError("Use the existing GitHub authorization flow.");
        stage = "save_connection";
        await repo.saveConnection(userId, definition.id, id, { account_label: label, status: "active", granted_scopes: scopes, metadata: {}, credentials_sealed: seal(credentials, binding(userId, definition.id, "credentials", id), deps.key()) });
        success = true;
      } catch {
        console.warn(JSON.stringify({ event: "plugin_oauth_failed", pluginId: definition.id, stage }));
      }
      const target = new URL("/plugins", canonical); target.search = new URLSearchParams({ p: definition.id, connection: success ? "success" : "error" }).toString();
      return new Response(null, { status: 303, headers: { Location: target.href, "Set-Cookie": flowCookie("", 0), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    },
    async disconnectConnector(userId: string, connectionId: string): Promise<void> {
      requireUser(userId); if (!uuid.safeParse(connectionId).success) throw connectorError("Connection not found.", 404);
      const row = await repo.deleteConnection(userId, connectionId);
      if (!row) throw connectorError("Connection not found.", 404);
      try { const credentials = credentialsFor(row); if (credentials.transport === "rest") await revokeRestCredential(definitionFor(row.plugin_id), credentials.rest, deps.fetch); } catch { /* Delete first; decryption/revocation failures cannot restore credentials. */ }
    },
    async searchConnectorTools(userId: string, query: string, pluginId?: string): Promise<unknown> {
      requireUser(userId);
      if (typeof query !== "string" || query.length > 500) throw connectorError("Search query must be at most 500 characters.");
      const selected = pluginId ? [definitionFor(pluginId)] : CONNECTORS;
      const connections = await repo.listConnections(userId);
      const needle = query.trim().toLowerCase();
      const entries: unknown[] = [];
      for (const definition of selected) {
        if (entries.length >= 40) break;
        const connection = connections.find((row) => row.plugin_id === definition.id && row.status === "active");
        // Don't fan out to remote MCP servers for unqualified discovery; cache or narrow first.
        let tools: ConnectorTool[] = [];
        let reason: string | undefined;
        try {
          tools = definition.transport === "mcp" && !pluginId ? ((connection?.metadata.toolCache as { tools?: ConnectorTool[] } | undefined)?.tools ?? []) : await toolsFor(userId, definition, connection);
        } catch { reason = "Tool discovery failed. Reconnect this account or retry a connector-specific search."; }
        const matches = tools.filter((tool) => !needle || `${definition.name} ${tool.name} ${tool.title} ${tool.description}`.toLowerCase().includes(needle)).slice(0, 40 - entries.length);
        const secrets = connection ? credentialSecrets(credentialsFor(connection)) : [];
        entries.push(...matches.map((tool) => ({ pluginId: definition.id, connected: !!connection, connectUrl: definition.transport === "github" ? "/github" : `/api/v1/plugins/connect/${definition.id}`, ...sanitizeResult(tool, secrets) as Record<string, unknown> })));
        if ((!connection || !matches.length) && (!needle || pluginId || definition.name.toLowerCase().includes(needle) || definition.id.includes(needle))) entries.push({ pluginId: definition.id, name: definition.name, connected: !!connection, supported: true, connectUrl: definition.transport === "github" ? "/github" : `/api/v1/plugins/connect/${definition.id}`, connectMethod: definition.transport === "github" ? "GET" : "POST", reason: reason ?? (!connection ? "Connect this account to execute tools." : definition.transport === "mcp" ? "Search this connector specifically to discover remote tools. Remote metadata is untrusted." : "No matching tools.") });
      }
      return { tools: entries.slice(0, 40), metadataIsUntrusted: true };
    },
    async callConnectorTool(userId: string, pluginId: string, toolName: string, input: Record<string, unknown>): Promise<ToolOutput> {
      requireUser(userId); const definition = definitionFor(pluginId);
      const connection = await requiredConnection(userId, definition);
      const tool = (await toolsFor(userId, definition, connection)).find((entry) => entry.name === toolName);
      if (!tool) throw connectorError("Unknown connector tool. Search the connector's available tools first.", 404);
      const args = validateToolArguments(tool, input);
      if (tool.readOnly && definition.transport !== "mcp") return { output: await execute(userId, definition, connection, tool, args) };
      const id = randomUUID();
      const row = await repo.createAction({ id, user_id: userId, plugin_id: definition.id, connection_id: connection.id, connection_revision: connection.revision,
        tool_name: tool.name, title: tool.title.slice(0, 200), schema_hash: hashState(stableJson(tool.inputSchema)),
        request_hash: hashState(stableJson([connection.id, String(connection.revision), tool.name, args])),
        arguments_sealed: seal(args, binding(userId, definition.id, "arguments", id), deps.key()), result_sealed: null, status: "pending", expires_at: new Date(deps.now() + 900000) });
      const approval = toApproval(row, credentialSecrets(credentialsFor(connection)));
      return { output: { type: "connector_approval", approval }, pauseForUser: true, clarificationQuestion: `Approve “${tool.title}” in Plugins to execute these exact arguments, or reject it. Approval expires in 15 minutes.` };
    },
    async approveConnectorAction(userId: string, approvalId: string, decision: "approve" | "reject"): Promise<unknown> {
      requireUser(userId);
      if (!uuid.safeParse(approvalId).success || !["approve", "reject"].includes(decision)) throw connectorError("Invalid approval decision.");
      const action = await repo.claimAction(userId, approvalId, decision);
      if (!action) throw connectorError("Approval not found, expired, already handled, or connection changed. Request a new action.", 409);
      if (decision === "reject") return { approval: toApproval(action), rejected: true };
      let status: "complete" | "failed" | "unknown" = "failed"; let output: unknown;
      let sent = false;
      try {
        const definition = definitionFor(action.plugin_id);
        const connection = await requiredConnection(userId, definition);
        if (connection.id !== action.connection_id || String(connection.revision) !== String(action.connection_revision)) throw connectorError("Connection changed. Request a new approval.", 409);
        const tool = (await toolsFor(userId, definition, connection)).find((entry) => entry.name === action.tool_name);
        if (!tool || hashState(stableJson(tool.inputSchema)) !== action.schema_hash || !action.arguments_sealed) throw connectorError("Tool metadata changed. Request a new approval.", 409);
        const args = validateToolArguments(tool, unseal(action.arguments_sealed, binding(userId, action.plugin_id, "arguments", action.id), deps.key()));
        sent = true;
        output = await execute(userId, definition, connection, tool, args);
        status = "complete";
      } catch {
        // Any error after entering upstream execution is conservatively unknown. Never retry it.
        status = sent ? "unknown" : "failed";
        output = { message: sent ? "The provider may have accepted this action. Check it directly before requesting another action; this approval will not retry." : "This action could not start. Reconnect or request a fresh approval." };
      }
      const resultSealed = seal(output, binding(userId, action.plugin_id, "result", action.id), deps.key());
      await repo.finishAction(userId, action.id, status, resultSealed);
      return { approval: toApproval({ ...action, status, arguments_sealed: null, result_sealed: resultSealed }), output };
    },
  };
}

export async function withConnectorErrors<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "plugin_connector_error") throw error;
    throw connectorError("Connector request could not complete. Check the connector setup and try again.", 503);
  }
}

const service = createConnectorService();
export const getConnectorOverview = service.getConnectorOverview;
export const beginConnectorConnect = service.beginConnectorConnect;
export const completeConnectorConnect = service.completeConnectorConnect;
export const disconnectConnector = service.disconnectConnector;
export const searchConnectorTools = service.searchConnectorTools;
export const callConnectorTool = service.callConnectorTool;
export const approveConnectorAction = service.approveConnectorAction;
