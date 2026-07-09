import { NextResponse } from "next/server";
import { AppError } from "@/backend/db/errors";

const isProduction =
  process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

/** Never leak stack traces or raw driver errors to clients in production. */
function publicErrorMessage(error: Error, fallback: string): string {
  if (!isProduction) return error.message || fallback;
  return fallback;
}

export function jsonData<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function jsonError(error: AppError | Error, status?: number) {
  if (error instanceof AppError) {
    // Database errors may carry internal SQL — generic message in production
    const message =
      isProduction && error.code === "database_error"
        ? "A database error occurred."
        : error.message;
    return NextResponse.json(
      { error: { message, code: error.code } },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: {
        message: publicErrorMessage(error, "Internal server error."),
        code: "internal_error",
      },
    },
    { status: status ?? 500 },
  );
}
