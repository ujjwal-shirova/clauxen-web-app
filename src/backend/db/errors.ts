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

export function mapPgError(error: unknown): AppError {
  const pg = error as { code?: string; message?: string };
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

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
  return new AppError(
    isProduction ? "A database error occurred." : pg.message || "Database error.",
    500,
    "database_error",
  );
}
