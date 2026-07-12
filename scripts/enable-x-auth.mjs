#!/usr/bin/env node
/**
 * Enable Supabase Auth provider: X / Twitter (OAuth 2.0).
 *
 * Requires:
 *   SUPABASE_ACCESS_TOKEN  — https://supabase.com/dashboard/account/tokens
 *   X_CLIENT_ID            — X Developer Portal → App → Keys and tokens (OAuth 2.0)
 *   X_CLIENT_SECRET        — same
 *
 * Optional:
 *   SUPABASE_PROJECT_REF   — defaults to ntplcfsbcyhiqklkbldk (clauxen-database-main)
 *
 * Usage:
 *   node scripts/enable-x-auth.mjs
 */

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF?.trim() || "ntplcfsbcyhiqklkbldk";
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const clientId = process.env.X_CLIENT_ID?.trim();
const clientSecret = process.env.X_CLIENT_SECRET?.trim();

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

if (!token) fail("set SUPABASE_ACCESS_TOKEN");
if (!clientId) fail("set X_CLIENT_ID");
if (!clientSecret) fail("set X_CLIENT_SECRET");

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    external_x_enabled: true,
    external_x_client_id: clientId,
    external_x_secret: clientSecret,
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error(text);
  fail(`Supabase Management API returned ${res.status}`);
}

console.log(`✓ Enabled X / Twitter (OAuth 2.0) on project ${PROJECT_REF}`);
console.log("  Callback URL: https://auth.clauxen.com/auth/v1/callback");
console.log(
  "  Ensure that callback is set in the X Developer Portal, and “Request email from users” is ON.",
);
