import { Client } from "pg";
import type { Provider } from "./protocol";
import { ensure } from "./protocol";

export async function canonicalEmail(connectionString: string, provider: Provider, subject: string, verifiedEmail: string): Promise<string> {
  const client = new Client({ connectionString, ssl: false, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL ROLE clauxen_oauth_reader");
    const result = await client.query<{ email: string }>("SELECT email FROM clauxen_auth.resolve_oauth_identity($1, $2)", [provider, subject]);
    await client.query("COMMIT");
    ensure(result.rows.length <= 1, 403, "identity_conflict");
    const email = result.rows.length ? result.rows[0].email : verifiedEmail;
    ensure(email && email.includes("@"), 403, "identity_conflict");
    return email;
  } finally { await client.end(); }
}
