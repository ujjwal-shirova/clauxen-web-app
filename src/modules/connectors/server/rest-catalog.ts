import "server-only";

import { query } from "@/server/db/pool";
import {
  REST_PROVIDER_BY_KEY,
  REST_PROVIDERS,
  type RestProviderRecipe,
} from "@/connectors/server/rest-providers";

export type PlatformConnector = {
  key: string;
  name: string;
  provider: string;
  protocol: "rest" | "mcp" | "custom";
  authType: string;
  status: string;
  scopes: string[];
  documentationUrl: string | null;
  capabilities: unknown;
  toolCount: number;
  oauthConfigured: boolean;
  connected: boolean;
  installationId: string | null;
  connectionStatus: string | null;
  description: string;
};

type CatalogRow = {
  key: string;
  name: string;
  provider: string;
  protocol: "rest" | "mcp" | "custom";
  authType: string;
  status: string;
  scopes: string[];
  documentationUrl: string | null;
  capabilities: unknown;
  toolCount: number;
  oauthConfigured: boolean;
};

type InstallationRow = {
  connectorKey: string;
  installationId: string;
  status: string;
};

function recipeDescription(recipe: RestProviderRecipe): string {
  return `Connect ${recipe.name} through Cloudflare OAuth. Tokens are sealed in Supabase before they are stored.`;
}

export async function listPlatformConnectors(
  userId: string,
): Promise<{ connectors: PlatformConnector[] }> {
  const [catalog, installations] = await Promise.all([
    query<CatalogRow>(
      `select catalog.key,
              catalog.name,
              catalog.provider,
              catalog.protocol,
              catalog.auth_type as "authType",
              catalog.status,
              catalog.scopes,
              catalog.documentation_url as "documentationUrl",
              catalog.capabilities,
              (
                select count(*)::int
                from public.connector_tools tool
                where tool.connector_id = catalog.id
                  and tool.is_enabled = true
              ) as "toolCount",
              exists (
                select 1
                from private.connector_oauth_configs config
                where config.connector_id = catalog.id
                  and config.enabled = true
              ) as "oauthConfigured"
       from public.connector_catalog catalog
       where catalog.status in ('active', 'beta')
         and catalog.protocol = 'rest'
       order by catalog.name`,
    ),
    query<InstallationRow>(
      `select catalog.key as "connectorKey",
              installation.id as "installationId",
              installation.status
       from public.connector_installations installation
       join public.connector_catalog catalog
         on catalog.id = installation.connector_id
       where installation.user_id = $1::uuid
         and installation.status <> 'revoked'
         and catalog.protocol = 'rest'`,
      [userId],
    ),
  ]);

  const byKey = new Map(catalog.map((row) => [row.key, row]));
  const connected = new Map(
    installations.map((row) => [row.connectorKey, row]),
  );

  const connectors: PlatformConnector[] = REST_PROVIDERS.map((recipe) => {
    const row = byKey.get(recipe.key);
    const install = connected.get(recipe.key);
    return {
      key: recipe.key,
      name: recipe.name,
      provider: recipe.provider,
      protocol: "rest",
      authType: row?.authType ?? recipe.authType,
      status: row?.status ?? recipe.status,
      scopes: row?.scopes?.length ? row.scopes : recipe.scopes,
      documentationUrl: row?.documentationUrl ?? recipe.documentationUrl,
      capabilities: row?.capabilities ?? recipe.capabilities,
      toolCount: row?.toolCount ?? recipe.tools.length,
      oauthConfigured: row?.oauthConfigured ?? false,
      connected: install?.status === "active",
      installationId: install?.installationId ?? null,
      connectionStatus: install?.status ?? null,
      description: recipeDescription(recipe),
    };
  });

  for (const row of catalog) {
    if (REST_PROVIDER_BY_KEY.has(row.key)) continue;
    const install = connected.get(row.key);
    connectors.push({
      key: row.key,
      name: row.name,
      provider: row.provider,
      protocol: row.protocol,
      authType: row.authType,
      status: row.status,
      scopes: row.scopes,
      documentationUrl: row.documentationUrl,
      capabilities: row.capabilities,
      toolCount: row.toolCount,
      oauthConfigured: row.oauthConfigured,
      connected: install?.status === "active",
      installationId: install?.installationId ?? null,
      connectionStatus: install?.status ?? null,
      description: `Connect ${row.name} through Cloudflare OAuth. Tokens are sealed in Supabase before they are stored.`,
    });
  }

  return { connectors };
}
