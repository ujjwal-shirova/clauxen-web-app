import "server-only";

import { AppError } from "@/server/db/errors";
import { query, queryOne, withTransaction } from "@/server/db/pool";
import { sealPluginApiKey } from "@/connectors/server/plugins/api-key-crypto";
import {
  REST_PROVIDER_BY_KEY,
  type RestProviderRecipe,
  type RestProviderTool,
} from "@/connectors/server/rest-providers";

export const REST_ACCESS_TOKEN_HINT: Record<string, string> = {
  github: "Paste a GitHub personal access token with repo access.",
  slack: "Paste a Slack bot token (starts with xoxb-).",
  notion: "Paste a Notion internal integration secret.",
  gmail: "Paste a Google OAuth access token with Gmail scope.",
  "google-drive": "Paste a Google OAuth access token with Drive scope.",
  figma: "Paste a Figma personal access token.",
};

type LocalRestInstallResult = {
  status: "connected";
  connectorKey: string;
  installationId: string;
  toolCount: number;
  accountLabel: string | null;
};

function recipeOrThrow(connectorKey: string): RestProviderRecipe {
  const recipe = REST_PROVIDER_BY_KEY.get(connectorKey);
  if (!recipe) {
    throw new AppError("Unknown app.", 404, "plugin_not_found");
  }
  return recipe;
}

function pathParams(template: string): string[] {
  return [...template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]);
}

function fillPath(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = args[key];
    if (value == null || value === "") {
      throw new AppError(`Missing ${key}.`, 400, "invalid_tool_arguments");
    }
    return encodeURIComponent(String(value));
  });
}

function joinApiUrl(base: string, pathname: string): URL {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const relative = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return new URL(relative, normalizedBase);
}

function authHeaders(
  recipe: RestProviderRecipe,
  accessToken: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
  };
  if (recipe.key === "github") {
    headers.accept = "application/vnd.github+json";
    headers["x-github-api-version"] = "2022-11-28";
  }
  if (recipe.key === "notion") {
    headers["notion-version"] = "2022-06-28";
  }
  return headers;
}

async function probeAccessToken(
  recipe: RestProviderRecipe,
  accessToken: string,
): Promise<string | null> {
  const probes: Record<string, { url: string; method?: string }> = {
    github: { url: "https://api.github.com/user" },
    slack: { url: "https://slack.com/api/auth.test", method: "POST" },
    notion: { url: "https://api.notion.com/v1/users/me" },
    gmail: {
      url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    },
    "google-drive": {
      url: "https://www.googleapis.com/drive/v3/about?fields=user",
    },
    figma: { url: "https://api.figma.com/v1/me" },
  };
  const probe = probes[recipe.key];
  if (!probe) return null;
  const response = await fetch(probe.url, {
    method: probe.method ?? "GET",
    headers: authHeaders(recipe, accessToken),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status === 401) {
    throw new AppError(
      "That access token was rejected. Check the token and try again.",
      401,
      "plugin_api_key_invalid",
    );
  }
  if (!response.ok) {
    return null;
  }
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    if (payload.ok === false) {
      throw new AppError(
        "That access token was rejected. Check the token and try again.",
        401,
        "plugin_api_key_invalid",
      );
    }
    const login = payload.login;
    const name = payload.name;
    const email = payload.email;
    const user = payload.user;
    if (typeof login === "string" && login) return login;
    if (typeof name === "string" && name) return name;
    if (typeof email === "string" && email) return email;
    if (user && typeof user === "object") {
      const nested = user as Record<string, unknown>;
      if (typeof nested.emailAddress === "string") return nested.emailAddress;
      if (typeof nested.displayName === "string") return nested.displayName;
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
  }
  return null;
}

async function upsertRestCatalog(recipe: RestProviderRecipe): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `insert into public.connector_catalog
       (key, name, provider, auth_type, protocol, scopes, status, documentation_url, capabilities, metadata)
     values ($1, $2, $3, 'oauth2', 'rest', $4::text[], $5, $6, $7::jsonb, $8::jsonb)
     on conflict (key) do update set
       name = excluded.name,
       provider = excluded.provider,
       protocol = 'rest',
       status = excluded.status,
       documentation_url = excluded.documentation_url,
       capabilities = excluded.capabilities,
       metadata = coalesce(public.connector_catalog.metadata, '{}'::jsonb) || excluded.metadata,
       updated_at = now()
     returning id`,
    [
      recipe.key,
      recipe.name,
      recipe.provider,
      recipe.scopes,
      recipe.status,
      recipe.documentationUrl,
      JSON.stringify(recipe.capabilities),
      JSON.stringify({ apiBaseUrl: recipe.apiBaseUrl, installedVia: "local-token" }),
    ],
  );
  if (!row?.id) throw new Error("REST catalog upsert failed");
  return row.id;
}

async function writeRestTools(
  connectorId: string,
  tools: RestProviderTool[],
): Promise<void> {
  await withTransaction(async (client) => {
    const names: string[] = [];
    for (const tool of tools) {
      names.push(tool.name);
      await client.query(
        `insert into public.connector_tools
           (connector_id, name, title, description, input_schema,
            risk_level, requires_confirmation, is_enabled,
            http_method, path_template, metadata)
         values ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, true, $8, $9, $10::jsonb)
         on conflict (connector_id, name) do update set
           title = excluded.title,
           description = excluded.description,
           input_schema = excluded.input_schema,
           risk_level = excluded.risk_level,
           requires_confirmation = excluded.requires_confirmation,
           is_enabled = true,
           http_method = excluded.http_method,
           path_template = excluded.path_template,
           metadata = excluded.metadata,
           updated_at = now()`,
        [
          connectorId,
          tool.name,
          tool.title,
          tool.description,
          JSON.stringify(tool.inputSchema),
          tool.riskLevel,
          Boolean(tool.requiresConfirmation || tool.riskLevel !== "read"),
          tool.httpMethod,
          tool.pathTemplate,
          JSON.stringify({
            kind: "rest",
            mcpName: tool.name,
            httpMethod: tool.httpMethod,
            pathTemplate: tool.pathTemplate,
          }),
        ],
      );
    }
    if (names.length > 0) {
      await client.query(
        `update public.connector_tools
         set is_enabled = false, updated_at = now()
         where connector_id = $1::uuid and not (name = any($2))`,
        [connectorId, names],
      );
    }
  });
}

async function upsertInstallation(input: {
  connectorId: string;
  userId: string;
  accountLabel: string | null;
}): Promise<string> {
  const inserted = await queryOne<{ id: string }>(
    `insert into public.connector_installations
       (connector_id, user_id, status, account_label, connected_at, settings)
     values ($1::uuid, $2::uuid, 'active', $3, now(), '{"installedVia":"local-token"}'::jsonb)
     on conflict do nothing
     returning id`,
    [input.connectorId, input.userId, input.accountLabel],
  );
  if (inserted?.id) return inserted.id;
  const existing = await queryOne<{ id: string }>(
    `select id from public.connector_installations
     where connector_id = $1::uuid and user_id = $2::uuid and workspace_id is null
     limit 1`,
    [input.connectorId, input.userId],
  );
  if (!existing?.id) throw new Error("REST installation could not be created");
  await query(
    `update public.connector_installations
     set status = 'active',
         account_label = coalesce($2, account_label),
         last_error_code = null,
         last_error_at = null,
         connected_at = coalesce(connected_at, now()),
         settings = coalesce(settings, '{}'::jsonb) || '{"installedVia":"local-token"}'::jsonb,
         updated_at = now()
     where id = $1::uuid`,
    [existing.id, input.accountLabel],
  );
  return existing.id;
}

export async function installRestConnectorLocal(
  userId: string,
  connectorKey: string,
  accessToken: string,
): Promise<LocalRestInstallResult> {
  const recipe = recipeOrThrow(connectorKey);
  const token = accessToken.trim();
  if (!token) {
    throw new AppError(
      REST_ACCESS_TOKEN_HINT[connectorKey] ||
        "This app needs an access token to connect.",
      409,
      "plugin_api_key_required",
    );
  }

  let accountLabel: string | null = null;
  try {
    accountLabel = await probeAccessToken(recipe, token);
  } catch (error) {
    if (error instanceof AppError) throw error;
    accountLabel = null;
  }

  const connectorId = await upsertRestCatalog(recipe);
  await writeRestTools(connectorId, recipe.tools);
  const installationId = await upsertInstallation({
    connectorId,
    userId,
    accountLabel,
  });
  const sealed = sealPluginApiKey(token, installationId);
  await query(
    `insert into private.plugin_mcp_api_keys
       (installation_id, encrypted_api_key, api_key_nonce, encryption_key_version)
     values ($1::uuid, $2, $3, $4)
     on conflict (installation_id) do update set
       encrypted_api_key = excluded.encrypted_api_key,
       api_key_nonce = excluded.api_key_nonce,
       encryption_key_version = excluded.encryption_key_version,
       updated_at = now()`,
    [installationId, sealed.ciphertext, sealed.nonce, sealed.version],
  );
  await query(
    `insert into public.connector_audit_events
       (user_id, installation_id, connector_key, event_type, status, metadata)
     values ($1::uuid, $2::uuid, $3, 'rest_connected', 'succeeded', $4::jsonb)`,
    [
      userId,
      installationId,
      recipe.key,
      JSON.stringify({ via: "local-token", toolCount: recipe.tools.length }),
    ],
  ).catch(() => undefined);

  return {
    status: "connected",
    connectorKey: recipe.key,
    installationId,
    toolCount: recipe.tools.length,
    accountLabel,
  };
}

export async function executeRestTool(input: {
  connectorKey: string;
  toolName: string;
  args: Record<string, unknown>;
  accessToken: string;
}): Promise<{ text: string; isError: boolean }> {
  const recipe = recipeOrThrow(input.connectorKey);
  const tool = recipe.tools.find((item) => item.name === input.toolName);
  if (!tool) {
    return { text: `Unknown ${recipe.name} tool.`, isError: true };
  }

  const pathKeys = new Set(pathParams(tool.pathTemplate));
  let pathname: string;
  try {
    pathname = fillPath(tool.pathTemplate, input.args);
  } catch (error) {
    return {
      text: error instanceof Error ? error.message : "Invalid tool arguments.",
      isError: true,
    };
  }

  const url = joinApiUrl(recipe.apiBaseUrl, pathname);
  if (url.origin === "null") {
    return { text: "Invalid API URL.", isError: true };
  }

  const bodyArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.args)) {
    if (pathKeys.has(key) || value == null) continue;
    if (tool.httpMethod === "GET" || tool.httpMethod === "DELETE") {
      url.searchParams.set(key, String(value));
    } else {
      bodyArgs[key] = value;
    }
  }

  const headers = authHeaders(recipe, input.accessToken);
  if (tool.httpMethod !== "GET" && tool.httpMethod !== "DELETE") {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(url, {
    method: tool.httpMethod,
    headers,
    body:
      tool.httpMethod === "GET" || tool.httpMethod === "DELETE"
        ? undefined
        : JSON.stringify(bodyArgs),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      text: `${recipe.name} ${tool.title} failed (${response.status}): ${text.slice(0, 4000)}`,
      isError: true,
    };
  }
  return { text: text.slice(0, 100_000) || "OK", isError: false };
}
