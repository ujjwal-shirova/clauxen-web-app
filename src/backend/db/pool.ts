import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env, requireDatabaseUrl } from "@/backend/config/env";
import { AppError, mapPgError } from "@/backend/db/errors";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!env.databaseUrl) {
    throw new AppError(
      "DATABASE_URL is not configured.",
      503,
      "database_unavailable",
    );
  }

  if (!pool) {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl: env.databaseUrl.includes("sslmode=disable")
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
    throw mapPgError(error);
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
    throw error instanceof AppError ? error : mapPgError(error);
  } finally {
    client.release();
  }
}
