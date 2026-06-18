import { readFileSync, existsSync } from "node:fs";

/** Load KEY=VALUE lines into process.env (does not override existing). */
export function loadEnvFile(path, { override = false } = {}) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (override || !process.env[m[1]]) process.env[m[1]] = val;
  }
}

export function loadCrdbEnv(repoRoot) {
  loadEnvFile(`${repoRoot}/.env.local`);
}

export function pgClientOpts(url) {
  let connectionString = url;
  try {
    const u = new URL(url);
    // Node pg treats require/prefer as verify-full; relax for migration scripts.
    if (
      process.env.COCKROACH_SSL_REJECT_UNAUTHORIZED === "0" ||
      u.hostname.includes("supabase") ||
      u.hostname.includes("pooler")
    ) {
      u.searchParams.set("uselibpqcompat", "true");
      u.searchParams.set("sslmode", "require");
      connectionString = u.toString();
    }
  } catch {
    /* keep original url */
  }

  const opts = { connectionString, connectionTimeoutMillis: 60_000 };
  if (process.env.COCKROACH_SSL_REJECT_UNAUTHORIZED === "0") {
    opts.ssl = { rejectUnauthorized: false };
  }
  return opts;
}

export function targetDbUrl(baseUrl, database) {
  const u = new URL(baseUrl);
  u.pathname = `/${database}`;
  return u.toString();
}
