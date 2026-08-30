import { Pool, type PoolClient, type QueryResultRow } from "pg";
import "@/lib/vercel-env";
import { env, requireDatabaseUrl } from "@/server/config/env";
import { AppError, mapPgError } from "@/server/db/errors";

let pool: Pool | null = null;

const CONNECT_RETRY_DELAYS_MS = [125, 350] as const;

function isConnectionAcquisitionError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  const message = candidate?.message ?? "";
  return (
    candidate?.code === "ETIMEDOUT" ||
    candidate?.code === "ECONNREFUSED" ||
    /timeout exceeded when trying to connect/i.test(message) ||
    /connection terminated due to connection timeout/i.test(message)
  );
}

function retirePool(failedPool: Pool): void {
  if (pool === failedPool) pool = null;
  // Do not await a pool that is already failing to acquire a connection.
  void failedPool.end().catch(() => undefined);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Vercel must use Supabase's IPv4 transaction pooler. The marketplace can
    // supply either a direct database URL or a session-pooler URL, and both
    // can intermittently time out from serverless isolates. Canonicalise both
    // forms to port 6543; credentials stay the same.
    const directSupabase = /^db\.([^.]+)\.supabase\.co$/i.exec(parsed.hostname);
    const pooledSupabase = parsed.hostname.endsWith(".pooler.supabase.com");
    if (env.isVercel && (directSupabase || pooledSupabase)) {
      const usernameRef = /^postgres\.([a-z0-9]+)$/i.exec(
        decodeURIComponent(parsed.username),
      )?.[1];
      const projectRef = directSupabase?.[1] ?? usernameRef;
      // If a custom pooler user cannot identify the project, retain its host
      // rather than risking a malformed connection string.
      if (!projectRef) return url;
      const region = process.env.SUPABASE_DB_REGION?.trim() || "us-west-1";
      const cluster = process.env.SUPABASE_POOLER_CLUSTER?.trim() || "aws-1";
      parsed.hostname = `${cluster}-${region}.pooler.supabase.com`;
      parsed.port = "6543";
      if (decodeURIComponent(parsed.username) === "postgres") {
        parsed.username = `postgres.${projectRef}`;
      }
    }
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
      // Reusing a warm transaction-pooler socket avoids a new TLS handshake on
      // every request while allowExitOnIdle still lets a Vercel isolate finish.
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
      query_timeout: 35_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
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
  for (let attempt = 0; ; attempt += 1) {
    const activePool = getPool();
    try {
      const result = await activePool.query<T>(text, params);
      return result.rows;
    } catch (error) {
      const delay = CONNECT_RETRY_DELAYS_MS[attempt];
      if (!isConnectionAcquisitionError(error) || delay === undefined) {
        throw mapPgError(error, "pool.query");
      }
      retirePool(activePool);
      await wait(delay);
    }
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
    for (let attempt = 0; ; attempt += 1) {
      const activePool = getPool();
      try {
        client = await activePool.connect();
        break;
      } catch (error) {
        const delay = CONNECT_RETRY_DELAYS_MS[attempt];
        if (!isConnectionAcquisitionError(error) || delay === undefined) {
          throw error;
        }
        retirePool(activePool);
        await wait(delay);
      }
    }
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
