import { Pool } from "pg";
import { env, requireDatabaseUrl } from "@/backend/config/env";
import { AppError, mapPgError } from "@/backend/db/errors"; // HTTP-friendly DB errors
let pool = null;
export function getPool() {
  if (!env.cockroachDatabaseUrl) {
    throw new AppError(
      "COCKROACH_DATABASE_URL is not configured.",
      503,
      "database_unavailable",
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: requireDatabaseUrl(), // full connection string — user, password, host, database
      max: 10,
      idleTimeoutMillis: 30000,
      ssl: env.cockroachDatabaseUrl.includes("sslmode=disable")
        ? false // local docker/cockroach start — plain TCP
        : { rejectUnauthorized: false }, // Cockroach Cloud — TLS on, cert verify relaxed (managed CA)
    });
  }
  return pool;
}
export async function query(
  text, // SQL string — placeholders $1, $2, …
  params = [],
) {
  try {
    const result = await getPool().query(text, params); // execute — Result object
    return result.rows;
  } catch (error) {
    throw mapPgError(error);
  }
}
export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}
// explicit transaction — multiple statements atomic
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error instanceof AppError ? error : mapPgError(error);
  } finally {
    client.release();
  }
}
