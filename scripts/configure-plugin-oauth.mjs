/* eslint-disable security/detect-non-literal-fs-filename -- Source files are operator-selected credentials; destinations stay inside this project. */
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const providers = new Set([
  "google", "microsoft", "slack", "linear", "airtable", "asana", "todoist",
  "dropbox", "zoom", "hubspot",
]);
const { values } = parseArgs({
  options: {
    provider: { type: "string" },
    file: { type: "string" },
    "seal-key-file": { type: "string" },
    cloudflare: { type: "boolean", default: false },
  },
});

function readBounded(path) {
  const value = readFileSync(resolve(path), "utf8");
  if (Buffer.byteLength(value) > 65536) throw new Error("Credential file is too large.");
  return value;
}

function credential(value, label) {
  if (typeof value !== "string" || !value.trim() || value.length > 4096 || /[\r\n\0]/.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value.trim();
}

const entries = {};
if (values["seal-key-file"]) {
  const key = readBounded(values["seal-key-file"]).trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(key) || Buffer.from(key, "base64").byteLength !== 32) {
    throw new Error("The token sealing key must be 32 bytes encoded as base64.");
  }
  entries.PLUGIN_TOKEN_SEAL_KEY = key;
}
if (values.provider || values.file) {
  if (!values.provider || !providers.has(values.provider) || !values.file) {
    throw new Error("Pass a supported --provider and a local --file containing OAuth app credentials.");
  }
  const parsed = JSON.parse(readBounded(values.file));
  const config = values.provider === "google" ? parsed.web : parsed;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Expected OAuth app JSON; Google requires a web-application client.");
  }
  const prefix = `PLUGIN_OAUTH_${values.provider.toUpperCase()}`;
  entries[`${prefix}_CLIENT_ID`] = credential(config.client_id, "OAuth client ID");
  entries[`${prefix}_CLIENT_SECRET`] = credential(config.client_secret, "OAuth client secret");
}
if (!Object.keys(entries).length) {
  throw new Error("Pass --seal-key-file or --provider and --file. Credentials are never printed.");
}

for (const name of [".env.local", ".dev.vars"]) {
  const path = resolve(root, name);
  let text = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [key, value] of Object.entries(entries)) {
    const lines = text.split(/\r?\n/);
    const existing = lines.filter((line) => line.startsWith(`${key}=`));
    if (key === "PLUGIN_TOKEN_SEAL_KEY" && existing.length) {
      for (const line of existing) {
        const stored = line.slice(key.length + 1).trim();
        if (stored !== value && stored !== JSON.stringify(value)) {
          throw new Error("An existing token sealing key differs. Refusing to replace it without credential re-encryption.");
        }
      }
    }
    text = lines.filter((line) => !line.startsWith(`${key}=`)).join("\n");
    if (text && !text.endsWith("\n")) text += "\n";
    text += `${key}=${JSON.stringify(value)}\n`;
  }
  const pending = `${path}.plugin-${randomUUID()}`;
  writeFileSync(pending, text, { mode: 0o600, flag: "wx" });
  renameSync(pending, path);
}

if (values.cloudflare) {
  if (entries.PLUGIN_TOKEN_SEAL_KEY) {
    throw new Error("Provision the initial sealing key with wrangler secret put; this command never rotates the production key.");
  }
  const path = resolve(root, "tmp", `plugin-oauth-${randomUUID()}.json`);
  writeFileSync(path, JSON.stringify(entries), { mode: 0o600, flag: "wx" });
  try {
    const result = spawnSync("wrangler", ["secret", "bulk", path, "--config", resolve(root, "wrangler.jsonc")], {
      cwd: root,
      stdio: "inherit",
    });
    if (result.error || result.status !== 0) throw new Error("Cloudflare OAuth credential provisioning failed.");
  } finally {
    unlinkSync(path);
  }
}
console.log(`Configured ${Object.keys(entries).length} connector variables; credential values were not printed.`);
