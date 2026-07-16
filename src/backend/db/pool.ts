import { Pool, type PoolClient, type QueryResultRow } from "pg";
import "@/lib/vercel-env";
import { env, requireDatabaseUrl } from "@/backend/config/env";
import { AppError, mapPgError } from "@/backend/db/errors";

let pool: Pool | null = null;

function normalizeDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Avoid pg sslmode deprecation warnings flooding Vercel runtime logs.
    if (parsed.searchParams.has("sslmode")) {
      parsed.searchParams.delete("sslmode");
    }
    parsed.searchParams.delete("uselibpqcompat");
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getPool(): Pool {
  if (!env.databaseUrl) {
    throw new AppError(
      "Database URL is not configured. Set POSTGRES_URL_NON_POOLING or DATABASE_URL.",
      503,
      "database_unavailable",
    );
  }

  if (!pool) {
    const connectionString = normalizeDatabaseUrl(requireDatabaseUrl());
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl: connectionString.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    const result = await getPool().query<T>(text, params);
    return result.rows;
  } catch (error) {
    throw mapPgError(error, "pool.query");
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error instanceof AppError ? error : mapPgError(error, "pool.tx");
  } finally {
    client.release();
  }
}
