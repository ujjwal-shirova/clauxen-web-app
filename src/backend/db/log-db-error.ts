/**
 * Defensive logging for Postgres / PostgREST failures.
 * Captures table/column/code so "database error" is diagnosable in server logs
 * without leaking SQL to API clients.
 */
export function logDbError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const err = error as {
    code?: string;
    message?: string;
    detail?: string;
    hint?: string;
    schema?: string;
    table?: string;
    column?: string;
    constraint?: string;
    where?: string;
    severity?: string;
    routine?: string;
  };

  console.error(`[db:${scope}]`, {
    code: err?.code ?? null,
    message: err?.message ?? (error instanceof Error ? error.message : String(error)),
    detail: err?.detail ?? null,
    hint: err?.hint ?? null,
    schema: err?.schema ?? null,
    table: err?.table ?? null,
    column: err?.column ?? null,
    constraint: err?.constraint ?? null,
    where: err?.where ?? null,
    routine: err?.routine ?? null,
    ...context,
  });
}
