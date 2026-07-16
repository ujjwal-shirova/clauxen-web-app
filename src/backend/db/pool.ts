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

function resolvePoolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(configured) && configured >= 1) {
    return Math.min(Math.floor(configured), 10);
  }

  // A Vercel function can scale into several isolates. One checked-out
  // connection per isolate is deliberate: Supabase session poolers otherwise
  // exhaust their client budget before a single user interaction completes.
  return env.isVercel ? 1 : 10;
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
      max: resolvePoolMax(),
      idleTimeoutMillis: env.isVercel ? 5_000 : 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: env.isVercel,
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
  let client: PoolClient | null = null;
  try {
    client = await getPool().connect();
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The connection may already be closed after a failed BEGIN/COMMIT.
      }
    }
    throw error instanceof AppError ? error : mapPgError(error, "pool.tx");
  } finally {
    client?.release();
  }
}
