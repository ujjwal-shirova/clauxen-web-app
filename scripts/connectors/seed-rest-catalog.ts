/**
 * Upsert Clauxen REST connector recipes into connector_catalog + connector_tools.
 *
 * Usage: npx tsx scripts/connectors/seed-rest-catalog.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import {
  REST_PROVIDERS,
  oauthRecipeMetadata,
} from "../../src/modules/connectors/server/rest-providers";

function loadDotEnvLocal() {
  const file = join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadDotEnvLocal();

const databaseUrl = (process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  try {
    for (const recipe of REST_PROVIDERS) {
      const catalog = await client.query<{ id: string }>(
        `insert into public.connector_catalog (
           key, name, provider, auth_type, protocol, scopes, status,
           documentation_url, capabilities, metadata
         ) values (
           $1, $2, $3, 'oauth2', 'rest', $4::text[], $5, $6, $7::jsonb, $8::jsonb
         )
         on conflict (key) do update set
           name = excluded.name,
           provider = excluded.provider,
           auth_type = 'oauth2',
           protocol = 'rest',
           scopes = excluded.scopes,
           status = excluded.status,
           documentation_url = excluded.documentation_url,
           capabilities = excluded.capabilities,
           metadata = coalesce(public.connector_catalog.metadata, '{}'::jsonb)
                      || excluded.metadata,
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
          JSON.stringify(oauthRecipeMetadata(recipe)),
        ],
      );
      const connectorId = catalog.rows[0]?.id;
      if (!connectorId) throw new Error(`Catalog upsert failed for ${recipe.key}`);

      for (const tool of recipe.tools) {
        await client.query(
          `insert into public.connector_tools (
             connector_id, name, title, description, input_schema,
             http_method, path_template, request_config, risk_level,
             requires_confirmation, is_enabled, metadata
           ) values (
             $1::uuid, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9, $10, true,
             '{"source":"clauxen-recipe"}'::jsonb
           )
           on conflict (connector_id, name) do update set
             title = excluded.title,
             description = excluded.description,
             input_schema = excluded.input_schema,
             http_method = excluded.http_method,
             path_template = excluded.path_template,
             request_config = excluded.request_config,
             risk_level = excluded.risk_level,
             requires_confirmation = excluded.requires_confirmation,
             is_enabled = true,
             metadata = excluded.metadata,
             updated_at = now()`,
          [
            connectorId,
            tool.name,
            tool.title,
            tool.description,
            JSON.stringify(tool.inputSchema),
            tool.httpMethod,
            tool.pathTemplate,
            JSON.stringify(tool.requestConfig ?? {}),
            tool.riskLevel,
            tool.requiresConfirmation === true ||
              tool.riskLevel === "write" ||
              tool.riskLevel === "destructive" ||
              tool.riskLevel === "sensitive",
          ],
        );
      }
      console.log(`seeded ${recipe.key} (${recipe.tools.length} tools)`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

