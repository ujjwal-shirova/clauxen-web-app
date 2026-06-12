export class AppError extends Error {
  constructor(message, status = 400, code = "bad_request") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}
export function notFound(message = "Not found") {
  return new AppError(message, 404, "not_found");
}
// 401 Unauthorized — session missing/invalid, login required
export function unauthorized(message = "Unauthorized") {
  return new AppError(message, 401, "unauthorized");
}
export function forbidden(message = "Forbidden") {
  return new AppError(message, 403, "forbidden");
}
export function conflict(message = "Conflict") {
  return new AppError(message, 409, "conflict");
}
export function mapPgError(error) {
  const pg = error; // pg/pg-compatible error object — code string hota hai
  if (pg.code === "23505") {
    // PostgreSQL SQLSTATE 23505 — unique_violation (duplicate primary/unique key)
    return conflict("Resource already exists.");
  }
  if (pg.code === "23503") {
    // SQLSTATE 23503 — foreign_key_violation (referenced row missing)
    return new AppError(
      "Referenced resource not found.",
      400,
      "invalid_reference",
    );
  }
  return new AppError(pg.message || "Database error.", 500, "database_error");
}
