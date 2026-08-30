import postgres, { type Sql } from "postgres";

export async function withDatabase<T>(
  env: Env,
  operation: (sql: Sql) => Promise<T>,
): Promise<T> {
  const sql = postgres(env.HYPERDRIVE.connectionString, {
    max: 1,
    fetch_types: false,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60,
    connection: {
      application_name: "clauxen-connector-gateway",
      statement_timeout: 30_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 10_000,
    },
  });
  try {
    return await operation(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}
