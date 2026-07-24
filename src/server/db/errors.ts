export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = "bad_request") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function notFound(message = "Not found"): AppError {
  return new AppError(message, 404, "not_found");
}

export function unauthorized(message = "Unauthorized"): AppError {
  return new AppError(message, 401, "unauthorized");
}

export function forbidden(message = "Forbidden"): AppError {
  return new AppError(message, 403, "forbidden");
}

export function conflict(message = "Conflict"): AppError {
  return new AppError(message, 409, "conflict");
}

export function mapPgError(error: unknown, scope = "query"): AppError {
  const pg = error as {
    code?: string;
    message?: string;
    table?: string;
    column?: string;
  };
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  // Always log the real driver error server-side (table/column/code).
  void import("@/server/db/log-db-error").then(({ logDbError }) => {
    logDbError(scope, error);
  });

  if (pg.code === "23505") {
    return conflict("Resource already exists.");
  }
  if (pg.code === "23503") {
    return new AppError(
      "Referenced resource not found.",
      400,
      "invalid_reference",
    );
  }
  if (
    pg.code === "53300" ||
    (pg.code === "XX000" &&
      /max clients|pool_size|too many connections/i.test(pg.message ?? ""))
  ) {
    return new AppError(
      "The database is temporarily busy. Please retry in a moment.",
      503,
      "database_busy",
    );
  }
  // Undefined column / missing relation — surface in non-prod for faster fixes.
  if (
    !isProduction &&
    (pg.code === "42703" || pg.code === "42P01") &&
    pg.message
  ) {
    return new AppError(pg.message, 500, "database_error");
  }
  return new AppError(
    isProduction ? "A database error occurred." : pg.message || "Database error.",
    500,
    "database_error",
  );
}
