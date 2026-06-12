/**
 * Normalize Postgres URLs for the MOLT binary (libpq semantics).
 * - Supabase: avoid verify-full surprises; prefer session/direct with require.
 * - Cockroach Cloud: use system trust store (no ~/.postgresql/root.crt).
 */
export function normalizeMoltSourceUrl(url) {
  const u = new URL(url);
  u.searchParams.set("uselibpqcompat", "true");
  u.searchParams.set("sslmode", "require");
  return u.toString();
}

export function normalizeMoltTargetUrl(url) {
  const u = new URL(url);
  // MOLT (libpq) often fails verify-full without a local root.crt; require still encrypts.
  if (u.hostname.endsWith(".cockroachlabs.cloud")) {
    u.searchParams.set("sslmode", "require");
    u.searchParams.delete("sslrootcert");
  }
  return u.toString();
}
