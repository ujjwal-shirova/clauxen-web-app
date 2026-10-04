/**
 * Structured server logging. Vercel captures stdout/stderr per invocation, so
 * JSON lines are searchable in the Vercel log viewer (filter by `scope`).
 */
type Fields = Record<string, unknown>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function logError(scope: string, error: unknown, fields?: Fields): void {
  console.error(
    JSON.stringify({ level: "error", scope, error: errorMessage(error), ...fields }),
  );
}

export function logWarn(scope: string, message: string, fields?: Fields): void {
  console.warn(JSON.stringify({ level: "warn", scope, message, ...fields }));
}

/**
 * `.catch(logged("scope"))` for best-effort background work: the failure is
 * non-fatal but must be visible instead of silently swallowed.
 */
export function logged<T = undefined>(
  scope: string,
  fields?: Fields,
  fallback?: T,
): (error: unknown) => T {
  return (error: unknown) => {
    logError(scope, error, fields);
    return fallback as T;
  };
}
