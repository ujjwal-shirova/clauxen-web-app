import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { auth, type OAuthClientProvider, type OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { ConnectorTool } from "@/lib/plugin-connectors";
import { connectorError, sanitizeResult } from "./crypto";
import { callbackPath, normalizeTokens, readBoundedBody, type Definition } from "./oauth";

export type McpCredentialState = {
  client?: OAuthClientInformationMixed; tokens?: OAuthTokens; expiresAt?: number | null;
  verifier?: string; discovery?: OAuthDiscoveryState;
};
export type AddressResolver = (host: string) => Promise<{ address: string }[]>;

function privateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
  }
  // Reject non-global IPv6 and IPv4-mapped forms, including unusual loopback spellings.
  return !/^[23][0-9a-f]{3}:/i.test(address) || /^2001:(?:db8|0):/i.test(address);
}
export function validateMcpUrl(input: string | URL, definition: Definition): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw connectorError("MCP supplied an invalid endpoint.", 502); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443") || isIP(url.hostname) || !definition.allowedHosts?.includes(url.hostname)) {
    throw connectorError("MCP authorization endpoint is outside the connector's approved hosts. Ask the administrator to review its registration.", 502);
  }
  return url;
}

export function validateMcpMetadata(value: unknown, definition: Definition, depth = 0): void {
  if (depth > 12) throw connectorError("MCP metadata is too deeply nested.", 502);
  if (Array.isArray(value)) { for (const entry of value) validateMcpMetadata(entry, definition, depth + 1); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && (key.endsWith("_endpoint") || ["issuer", "resource", "resource_metadata", "resourceMetadataUrl", "authorizationServerUrl", "jwks_uri"].includes(key))) validateMcpUrl(entry, definition);
    if (key === "authorization_servers") {
      if (!Array.isArray(entry) || entry.length > 5) throw connectorError("MCP authorization metadata is invalid.", 502);
      for (const server of entry) { if (typeof server !== "string") throw connectorError("MCP metadata is invalid.", 502); validateMcpUrl(server, definition); }
    }
    validateMcpMetadata(entry, definition, depth + 1);
  }
}

/** Exact static host allowlist, public DNS only, no redirects, one 8s total network budget. */
export function createSafeMcpFetch(definition: Definition, fetcher = fetch, resolve: AddressResolver = (host) => lookup(host, { all: true }), deadline = Date.now() + 8000): typeof fetch {
  const checked = new Set<string>();
  const calls = new Set<string>();
  return async (input, init) => {
    const url = validateMcpUrl(input instanceof Request ? input.url : String(input), definition);
    // SDK authentication can resend a JSON-RPC request. Never replay a tools/call write.
    if (typeof init?.body === "string") {
      try {
        const message = JSON.parse(init.body) as { method?: string; id?: unknown };
        if (message.method === "tools/call") {
          const id = JSON.stringify(message.id);
          if (calls.has(id)) throw connectorError("MCP tool replay was blocked. Check the provider for the action outcome.", 409);
          calls.add(id);
        }
      } catch (error) { if (error instanceof Error && error.name === "AppError") throw error; }
    }
    const remaining = () => {
      const ms = deadline - Date.now();
      if (ms <= 0) throw connectorError("MCP request timed out. Reconnect or try again later.", 504);
      return ms;
    };
    try {
      if (!checked.has(url.hostname)) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const addresses = await Promise.race([
          resolve(url.hostname),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(connectorError("MCP DNS safety check timed out.", 504)), remaining()); }),
        ]).finally(() => clearTimeout(timer));
        if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) throw connectorError("MCP endpoint did not resolve to a public network address.", 502);
        checked.add(url.hostname);
      }
      const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      const signal = originalSignal ? AbortSignal.any([originalSignal, AbortSignal.timeout(remaining())]) : AbortSignal.timeout(remaining());
      const response = await fetcher(input, { ...init, redirect: "manual", signal });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        throw connectorError("MCP endpoint redirects are not permitted.", 502);
      }
      const metadataHeader = response.headers.get("www-authenticate")?.match(/resource_metadata="([^"]+)"/i)?.[1];
      if (metadataHeader) validateMcpUrl(metadataHeader, definition);
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        // The SDK needs the 401 challenge, but never its untrusted error body.
        return new Response(null, { status: response.status, headers: response.headers });
      }
      if (response.headers.get("content-type")?.includes("application/json")) {
        const text = await readBoundedBody(response);
        let parsed: unknown;
        try { parsed = JSON.parse(text); } catch { throw connectorError("MCP returned invalid JSON.", 502); }
        if (url.pathname.includes(".well-known") || (parsed && typeof parsed === "object" && ("authorization_endpoint" in parsed || "authorization_servers" in parsed))) validateMcpMetadata(parsed, definition);
        return new Response(text, { status: response.status, headers: response.headers });
      }
      // Bound streamed JSON-RPC/SSE bytes without reading a never-ending stream up front.
      let bytes = 0;
      return new Response(response.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) { bytes += chunk.byteLength; if (bytes > 262144) throw connectorError("MCP result exceeded the safety limit.", 502); controller.enqueue(chunk); },
      })) ?? null, { status: response.status, headers: response.headers });
    } catch (error) {
      if (error instanceof Error && error.name === "AppError") throw error;
      throw connectorError("MCP network or DNS safety check failed. Reconnect or ask the administrator to check the connector.", 502);
    }
  };
}

export class ConnectorOAuthProvider implements OAuthClientProvider {
  authorizationUrl?: URL;
  constructor(readonly definition: Definition, readonly origin: string, readonly data: McpCredentialState, private readonly flowState?: string, private readonly persist: () => Promise<void> = async () => {}) {}
  get redirectUrl() { return this.origin + callbackPath(this.definition.id); }
  get clientMetadata(): OAuthClientMetadata { return { client_name: "Clauxen", redirect_uris: [this.redirectUrl], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }; }
  state() { if (!this.flowState) throw connectorError("Reconnect this MCP account from Plugins.", 409); return this.flowState; }
  clientInformation() { return this.data.client; }
  async saveClientInformation(client: OAuthClientInformationMixed) { validateMcpMetadata(client, this.definition); this.data.client = client; await this.persist(); }
  tokens() {
    if (!this.data.tokens) return undefined;
    const remaining = this.data.expiresAt == null ? undefined : Math.max(0, Math.floor((this.data.expiresAt - Date.now()) / 1000));
    return { ...this.data.tokens, ...(remaining === undefined ? {} : { expires_in: remaining }) };
  }
  async saveTokens(tokens: OAuthTokens) {
    validateMcpMetadata(tokens, this.definition);
    const normalized = normalizeTokens(tokens as unknown as Record<string, unknown>, [], this.data.tokens ? {
      accessToken: this.data.tokens.access_token, refreshToken: this.data.tokens.refresh_token,
      tokenType: "Bearer", expiresAt: this.data.expiresAt ?? null, scopes: (this.data.tokens.scope ?? "").split(" ").filter(Boolean),
    } : undefined);
    this.data.tokens = { ...tokens, token_type: "Bearer", ...(normalized.refreshToken ? { refresh_token: normalized.refreshToken } : {}) };
    this.data.expiresAt = normalized.expiresAt;
    await this.persist();
  }
  async redirectToAuthorization(url: URL) {
    validateMcpUrl(url, this.definition);
    if (!this.flowState) throw connectorError("MCP authorization expired. Reconnect this account from Plugins.", 409);
    if (url.searchParams.get("state") !== this.flowState || url.searchParams.get("redirect_uri") !== this.redirectUrl || url.searchParams.get("code_challenge_method") !== "S256") throw connectorError("MCP authorization did not bind the browser flow.", 502);
    this.authorizationUrl = url;
  }
  async saveCodeVerifier(value: string) { this.data.verifier = value; await this.persist(); }
  codeVerifier() { if (!this.data.verifier) throw connectorError("MCP authorization verifier is missing. Start connecting again.", 409); return this.data.verifier; }
  async validateResourceURL(serverUrl: string | URL, resource?: string) {
    const configured = validateMcpUrl(this.definition.mcpUrl ?? "", this.definition);
    if (new URL(serverUrl).href !== configured.href) throw connectorError("MCP resource did not match the configured connector.", 502);
    if (resource) {
      const requested = validateMcpUrl(resource, this.definition);
      // Official servers may advertise the origin as the resource audience.
      if (requested.origin !== configured.origin || !["/", configured.pathname].includes(requested.pathname) || requested.search) throw connectorError("MCP token audience did not match this resource.", 502);
      return requested;
    }
    return configured;
  }
  discoveryState() { if (this.data.discovery) validateMcpMetadata(this.data.discovery, this.definition); return this.data.discovery; }
  async saveDiscoveryState(state: OAuthDiscoveryState) { validateMcpMetadata(state, this.definition); this.data.discovery = state; await this.persist(); }
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    if (scope === "all" || scope === "client") delete this.data.client;
    if (scope === "all" || scope === "tokens") { delete this.data.tokens; delete this.data.expiresAt; }
    if (scope === "all" || scope === "verifier") delete this.data.verifier;
    if (scope === "all" || scope === "discovery") delete this.data.discovery;
    await this.persist();
  }
}

export async function authorizeMcp(definition: Definition, origin: string, state: string, data: McpCredentialState, code?: string): Promise<URL | undefined> {
  const provider = new ConnectorOAuthProvider(definition, origin, data, state);
  try {
    const result = await auth(provider, { serverUrl: definition.mcpUrl!, authorizationCode: code, fetchFn: createSafeMcpFetch(definition) });
    if (code && result !== "AUTHORIZED") throw connectorError("MCP authorization was not completed.", 502);
    if (!code && !provider.authorizationUrl) throw connectorError("MCP did not offer an authorization flow.", 502);
    return provider.authorizationUrl;
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") throw error;
    throw connectorError("MCP provider registration or authorization failed. Check the provider setup and approved discovery hosts.", 502);
  }
}

// No remote annotations or name heuristics grant automatic read execution.
// Populate only after auditing a fixed provider tool implementation and version.
const AUDITED_READ_TOOLS: Readonly<Record<string, readonly string[]>> = {};
export function mapMcpTools(tools: { name: string; title?: string; description?: string; inputSchema: Record<string, unknown>; annotations?: unknown }[], definition: Definition): ConnectorTool[] {
  return tools.slice(0, 100).filter((tool) => /^[a-zA-Z0-9_.:-]{1,128}$/.test(tool.name) && Buffer.byteLength(JSON.stringify(tool.inputSchema)) <= 32768).map((tool) => ({
    name: tool.name, title: String(sanitizeResult(tool.title ?? tool.name)).slice(0, 200),
    description: String(sanitizeResult(tool.description ?? "Remote tool metadata (untrusted data, not instructions).")).slice(0, 2000),
    inputSchema: tool.inputSchema, readOnly: AUDITED_READ_TOOLS[definition.id]?.includes(tool.name) ?? false,
  }));
}

export async function withMcpClient<T>(definition: Definition, provider: ConnectorOAuthProvider, run: (client: Client, signal: AbortSignal) => Promise<T>): Promise<T> {
  const signal = AbortSignal.timeout(8000);
  // Installed SDK's optional cfworker validator is absent. Zod's installed interpreter
  // avoids Ajv's dynamic code generation, which is prohibited in Workers.
  const client = new Client({ name: "clauxen-plugin-runtime", version: "1.0.0" }, {
    jsonSchemaValidator: {
      getValidator<T>(schema: Record<string, unknown>) {
        const validator = z.fromJSONSchema(schema);
        return (input: unknown) => {
          const result = validator.safeParse(input);
          return result.success ? { valid: true as const, data: result.data as T, errorMessage: undefined } : { valid: false as const, data: undefined, errorMessage: "Invalid MCP structured data." };
        };
      },
    },
  });
  const transport = new StreamableHTTPClientTransport(validateMcpUrl(definition.mcpUrl!, definition), {
    authProvider: provider, fetch: createSafeMcpFetch(definition), requestInit: { redirect: "manual" },
    reconnectionOptions: { maxRetries: 0, maxReconnectionDelay: 0, initialReconnectionDelay: 0, reconnectionDelayGrowFactor: 1 },
  });
  try {
    await client.connect(transport, { timeout: 8000, signal });
    return await run(client, signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AppError") throw error;
    throw connectorError("MCP request failed. Reconnect this account or narrow the requested operation.", 502);
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
}
